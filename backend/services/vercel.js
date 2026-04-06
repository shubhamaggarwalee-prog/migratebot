/**
 * backend/services/vercel.js
 *
 * Vercel REST API service.
 * Handles project creation, environment variable injection,
 * Git-based deployment triggering, deployment status polling
 * until READY, and domain management.
 *
 * API reference: https://vercel.com/docs/rest-api
 *
 * Fix 7: Added getUser() — called by credentials.js /validate to confirm
 *        a token is valid and return account metadata to the frontend.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const VERCEL_API_URL = 'https://api.vercel.com';

// Vercel deployment ready states
const TERMINAL_READY   = ['READY'];
const TERMINAL_FAIL    = ['ERROR', 'CANCELED'];

class VercelService {
  /**
   * @param {string} token     - Vercel personal access token
   * @param {string} [teamId]  - Optional Vercel team ID (for team-scoped requests)
   */
  constructor(token, teamId = null) {
    if (!token) throw new Error('Vercel API token is required');
    this.token  = token;
    this.teamId = teamId || null;
    this.client = axios.create({
      baseURL: VERCEL_API_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ─── INTERNAL HELPERS ─────────────────────────────────────────────────────

  /** Attach teamId to query params when present */
  _params(extra = {}) {
    return this.teamId ? { teamId: this.teamId, ...extra } : extra;
  }

  /** Wrap axios calls and normalise Vercel error shapes */
  async _request(method, path, data = null, params = {}) {
    try {
      const res = await this.client.request({
        method,
        url: path,
        params: this._params(params),
        ...(data ? { data } : {}),
      });
      return res.data;
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message;
      const status = err.response?.status;
      const e = new Error(`Vercel API error${status ? ` (${status})` : ''}: ${msg}`);
      e.status = status;
      throw e;
    }
  }

  // ─── TOKEN VALIDATION ─────────────────────────────────────────────────────

  /**
   * Fetch the authenticated Vercel user.
   * Used by credentials.js /validate to confirm a token works and
   * return account metadata (username, email) to the frontend.
   *
   * @returns {{ username: string, email: string, name: string, id: string }}
   * @throws Error if the token is invalid or the request fails
   */
  async getUser() {
    const data = await this._request('GET', '/v2/user');
    const u = data?.user;
    if (!u) throw new Error('Vercel token is invalid or lacks user read access');
    return {
      id:       u.id,
      username: u.username,
      name:     u.name     || u.username,
      email:    u.email    || '',
    };
  }

  /**
   * Verify the token is valid by fetching the authed user.
   * @returns {boolean}
   */
  async validateToken() {
    try {
      const data = await this._request('GET', '/v2/user');
      return !!data?.user?.id;
    } catch {
      return false;
    }
  }

  // ─── PROJECTS ─────────────────────────────────────────────────────────────

  /**
   * Create a new Vercel project linked to a GitHub repo.
   *
   * @param {object} opts
   * @param {string}  opts.name        - Project name (must be unique per account/team)
   * @param {string}  opts.framework   - Vercel framework slug e.g. "nextjs", "create-react-app"
   * @param {object}  opts.gitRepo     - { owner: string, name: string } — GitHub repo
   * @param {string}  [opts.rootDir]   - Sub-directory root (monorepo), e.g. "frontend"
   * @param {string}  [opts.buildCmd]  - Override build command
   * @param {string}  [opts.outputDir] - Override output directory
   * @returns {{ projectId: string, name: string }}
   */
  async createProject({ name, framework, gitRepo, rootDir, buildCmd, outputDir }) {
    logger.info(`Creating Vercel project: ${name}`);
    const body = {
      name,
      ...(framework   ? { framework }          : {}),
      ...(rootDir     ? { rootDirectory: rootDir } : {}),
      ...(buildCmd    ? { buildCommand: buildCmd } : {}),
      ...(outputDir   ? { outputDirectory: outputDir } : {}),
      gitRepository: {
        type: 'github',
        repo: `${gitRepo.owner}/${gitRepo.name}`,
      },
    };
    const data = await this._request('POST', '/v9/projects', body);
    logger.info(`Vercel project created: ${data.id}`);
    return { projectId: data.id, name: data.name };
  }

  /**
   * Get an existing project by ID or name.
   * @param {string} idOrName
   * @returns {object} Raw Vercel project object
   */
  async getProject(idOrName) {
    return this._request('GET', `/v9/projects/${encodeURIComponent(idOrName)}`);
  }

  /**
   * List all projects for the authenticated user/team.
   * @returns {Array}
   */
  async getProjects() {
    const data = await this._request('GET', '/v9/projects');
    return data.projects || [];
  }

  /**
   * Delete a project by ID.
   * @param {string} projectId
   */
  async deleteProject(projectId) {
    await this._request('DELETE', `/v9/projects/${projectId}`);
    logger.info(`Vercel project deleted: ${projectId}`);
  }

  // ─── ENVIRONMENT VARIABLES ────────────────────────────────────────────────

  /**
   * Bulk-set environment variables on a Vercel project.
   * Each var is applied to production, preview, and development targets.
   *
   * @param {string}                  projectId
   * @param {Array<{key, value}>}     vars  - Array of { key, value } objects
   * @returns {object} Vercel API response
   */
  async setEnvVars(projectId, vars) {
    logger.info(`Setting ${vars.length} env var(s) on Vercel project ${projectId}`);
    const payload = vars.map(({ key, value }) => ({
      key,
      value,
      target: ['production', 'preview', 'development'],
      type: 'encrypted',
    }));
    return this._request('POST', `/v9/projects/${projectId}/env`, payload);
  }

  /**
   * Set env vars from a plain key/value object (convenience wrapper).
   * @param {string}                  projectId
   * @param {Record<string, string>}  envMap   - e.g. { NEXT_PUBLIC_API_URL: 'https://...' }
   */
  async setEnvVarsFromMap(projectId, envMap) {
    const vars = Object.entries(envMap).map(([key, value]) => ({ key, value }));
    return this.setEnvVars(projectId, vars);
  }

  /**
   * List all environment variables for a project.
   * @param {string} projectId
   * @returns {Array}
   */
  async getEnvVars(projectId) {
    const data = await this._request('GET', `/v9/projects/${projectId}/env`);
    return data.envs || [];
  }

  // ─── DEPLOYMENTS ──────────────────────────────────────────────────────────

  /**
   * Trigger a new deployment from a connected Git branch.
   *
   * @param {string} projectId
   * @param {string} [branch='main']  - Git branch to deploy
   * @returns {{ deploymentId: string, url: string }}
   */
  async createDeploymentFromGit(projectId, branch = 'main') {
    logger.info(`Triggering Vercel deployment for project ${projectId} (branch: ${branch})`);
    const data = await this._request('POST', '/v13/deployments', {
      name: projectId,
      project: projectId,
      gitSource: {
        type: 'github',
        ref: branch,
      },
    });
    logger.info(`Vercel deployment queued: ${data.id}`);
    return { deploymentId: data.id, url: data.url };
  }

  /**
   * Get a single deployment by ID.
   * @param {string} deploymentId
   * @returns {{ id, status, url, alias }}
   */
  async getDeployment(deploymentId) {
    const data = await this._request('GET', `/v13/deployments/${deploymentId}`);
    return {
      id:     data.id,
      status: data.readyState,   // Vercel uses readyState, not status
      url:    data.url,
      alias:  data.alias || [],
    };
  }

  /**
   * Poll until the deployment reaches READY, fails, or times out.
   *
   * Vercel readyState lifecycle:
   *   QUEUED → INITIALIZING → BUILDING → DEPLOYING → READY
   *                                               → ERROR / CANCELED
   *
   * @param {string} deploymentId
   * @param {number} [maxWaitMs=300000]  - 5-minute default timeout
   * @returns {{ success: true, url: string, deploymentId: string }}
   * @throws Error on failure or timeout
   */
  async waitForDeployment(deploymentId, maxWaitMs = 300_000) {
    const start = Date.now();
    logger.info(`Polling Vercel deployment ${deploymentId}...`);

    while (Date.now() - start < maxWaitMs) {
      const deployment = await this.getDeployment(deploymentId);

      logger.info(`Vercel deployment status: ${deployment.status}`);

      if (TERMINAL_READY.includes(deployment.status)) {
        // Prefer the first alias (the stable URL) over the preview URL
        const url =
          (deployment.alias && deployment.alias.length > 0
            ? `https://${deployment.alias[0]}`
            : `https://${deployment.url}`) || null;
        logger.info(`Vercel deployment READY: ${url}`);
        return { success: true, url, deploymentId };
      }

      if (TERMINAL_FAIL.includes(deployment.status)) {
        throw new Error(`Vercel deployment ${deployment.status.toLowerCase()}`);
      }

      await this.sleep(5000);
    }

    throw new Error(`Vercel deployment timed out after ${maxWaitMs / 1000}s`);
  }

  /**
   * Cancel an in-progress deployment.
   * @param {string} deploymentId
   */
  async cancelDeployment(deploymentId) {
    await this._request('PATCH', `/v13/deployments/${deploymentId}/cancel`);
    logger.info(`Vercel deployment ${deploymentId} cancelled`);
  }

  // ─── DOMAINS ──────────────────────────────────────────────────────────────

  /**
   * Add a domain to a Vercel project.
   * @param {string} projectId
   * @param {string} domain  e.g. "myapp.com"
   * @returns {object} Vercel domain object
   */
  async addDomain(projectId, domain) {
    logger.info(`Adding domain ${domain} to Vercel project ${projectId}`);
    return this._request('POST', `/v9/projects/${projectId}/domains`, { name: domain });
  }

  /**
   * Get DNS config for a domain (for CNAME/A record verification).
   * @param {string} domain
   * @returns {object}
   */
  async getDomainConfig(domain) {
    return this._request('GET', `/v6/domains/${domain}/config`);
  }

  /**
   * Remove a domain from a project.
   * @param {string} projectId
   * @param {string} domain
   */
  async removeDomain(projectId, domain) {
    await this._request('DELETE', `/v9/projects/${projectId}/domains/${domain}`);
    logger.info(`Domain ${domain} removed from Vercel project ${projectId}`);
  }

  // ─── FRAMEWORK MAPPING ────────────────────────────────────────────────────

  /**
   * Map a detected framework string to the Vercel framework slug.
   * Returns null if Vercel should auto-detect.
   *
   * @param {string} framework
   * @returns {string|null}
   */
  static mapFramework(framework) {
    if (!framework) return null;
    const map = {
      nextjs:            'nextjs',
      next:              'nextjs',
      react:             'create-react-app',
      'create-react-app':'create-react-app',
      vue:               'vue',
      nuxt:              'nuxtjs',
      svelte:            'svelte',
      sveltekit:         'sveltekit',
      gatsby:            'gatsby',
      astro:             'astro',
      remix:             'remix',
      vite:              'vite',
      angular:           'angular',
    };
    return map[framework.toLowerCase()] || null;
  }

  // ─── UTILS ────────────────────────────────────────────────────────────────

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VercelService;
