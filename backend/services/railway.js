/**
 * backend/services/railway.js
 *
 * Railway GraphQL API service.
 * Handles project creation, environment management, GitHub service linking,
 * environment variable injection, deployment triggering, status polling,
 * and domain generation — all via Railway's GraphQL v2 API.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

class RailwayService {
  constructor(token) {
    if (!token) throw new Error('Railway API token is required');
    this.token = token;
    this.client = axios.create({
      baseURL: RAILWAY_API_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ─── GRAPHQL EXECUTOR ──────────────────────────────────────────────────────

  async graphql(query, variables = {}) {
    try {
      const { data } = await this.client.post('', { query, variables });
      if (data.errors && data.errors.length > 0) {
        const msg = data.errors.map(e => e.message).join('; ');
        throw new Error(`Railway GraphQL error: ${msg}`);
      }
      return data.data;
    } catch (err) {
      if (err.response) {
        throw new Error(
          `Railway API HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
        );
      }
      throw err;
    }
  }

  // ─── PROJECT ───────────────────────────────────────────────────────────────

  /**
   * Create a new Railway project.
   * @param {string} name - Project display name
   * @returns {{ id: string, name: string }}
   */
  async createProject(name) {
    logger.info(`Creating Railway project: ${name}`);
    const data = await this.graphql(
      `mutation CreateProject($name: String!) {
        projectCreate(input: { name: $name }) {
          id
          name
        }
      }`,
      { name }
    );
    logger.info(`Railway project created: ${data.projectCreate.id}`);
    return data.projectCreate;
  }

  /**
   * List all projects for the authenticated user.
   * @returns {Array<{ id, name }>}
   */
  async getProjects() {
    const data = await this.graphql(
      `query {
        me {
          projects {
            edges {
              node {
                id
                name
                environments {
                  edges {
                    node { id name }
                  }
                }
              }
            }
          }
        }
      }`
    );
    return data.me.projects.edges.map(e => e.node);
  }

  // ─── ENVIRONMENT ───────────────────────────────────────────────────────────

  /**
   * Get the production (or first) environment for a project.
   * @param {string} projectId
   * @returns {{ id: string, name: string }}
   */
  async getEnvironment(projectId) {
    const data = await this.graphql(
      `query GetProject($id: String!) {
        project(id: $id) {
          environments {
            edges {
              node { id name }
            }
          }
        }
      }`,
      { id: projectId }
    );
    const envs = data.project.environments.edges;
    const prod = envs.find(e => e.node.name === 'production') || envs[0];
    if (!prod) throw new Error(`No environments found for Railway project ${projectId}`);
    return prod.node;
  }

  // ─── SERVICE ────────────────────────────────────────────────────────────────

  /**
   * Link a GitHub repo as a service inside a Railway project.
   * @param {string} projectId
   * @param {string} environmentId
   * @param {object} opts - { repoOwner, repoName, branch, rootDir }
   * @returns {{ id: string, name: string }}
   */
  async createGithubService(projectId, environmentId, {
    repoOwner,
    repoName,
    branch = 'main',
    rootDir = '',
  } = {}) {
    logger.info(`Linking GitHub repo ${repoOwner}/${repoName} to Railway project ${projectId}`);
    const data = await this.graphql(
      `mutation CreateService(
        $projectId: String!,
        $environmentId: String!,
        $source: ServiceSourceInput!
      ) {
        serviceCreate(input: {
          projectId: $projectId
          environmentId: $environmentId
          source: $source
          name: $repoName
        }) {
          id
          name
        }
      }`,
      {
        projectId,
        environmentId,
        source: {
          repo: `${repoOwner}/${repoName}`,
          branch,
          ...(rootDir ? { rootDirectory: rootDir } : {}),
        },
        repoName,
      }
    );
    logger.info(`Railway service created: ${data.serviceCreate.id}`);
    return data.serviceCreate;
  }

  /**
   * Create a Docker-image-based service (no GitHub link).
   * @param {string} projectId
   * @param {string} environmentId
   * @param {string} name
   * @returns {{ id: string, name: string }}
   */
  async createDockerService(projectId, environmentId, name) {
    logger.info(`Creating Docker service "${name}" in project ${projectId}`);
    const data = await this.graphql(
      `mutation CreateDockerService($projectId: String!, $name: String!) {
        serviceCreate(input: { projectId: $projectId, name: $name }) {
          id
          name
        }
      }`,
      { projectId, name }
    );
    return data.serviceCreate;
  }

  // ─── ENVIRONMENT VARIABLES ──────────────────────────────────────────────────

  /**
   * Bulk-upsert environment variables onto a Railway service.
   * @param {string} projectId
   * @param {string} environmentId
   * @param {string} serviceId
   * @param {Record<string, string>} vars  - Plain key/value map
   */
  async setEnvVars(projectId, environmentId, serviceId, vars) {
    const count = Object.keys(vars).length;
    logger.info(`Setting ${count} env var(s) on Railway service ${serviceId}`);
    const variables = Object.entries(vars).map(([name, value]) => ({ name, value }));
    const data = await this.graphql(
      `mutation SetVars(
        $serviceId: String!,
        $environmentId: String!,
        $variables: [VariableInput!]!
      ) {
        variableCollectionUpsert(input: {
          serviceId: $serviceId
          environmentId: $environmentId
          variables: $variables
        })
      }`,
      { serviceId, environmentId, variables }
    );
    return data.variableCollectionUpsert;
  }

  // ─── DEPLOYMENT ─────────────────────────────────────────────────────────────

  /**
   * Trigger a new deployment for a service.
   * @param {string} serviceId
   * @param {string} environmentId
   * @returns {boolean}
   */
  async triggerDeploy(serviceId, environmentId) {
    logger.info(`Triggering Railway deployment for service ${serviceId}`);
    const data = await this.graphql(
      `mutation Deploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId }
    );
    return data.serviceInstanceDeploy;
  }

  /**
   * Fetch a single deployment's current status.
   * @param {string} deploymentId
   * @returns {{ id, status, url }}
   */
  async getDeploymentStatus(deploymentId) {
    const data = await this.graphql(
      `query GetDeployment($id: String!) {
        deployment(id: $id) {
          id
          status
          createdAt
          url
        }
      }`,
      { id: deploymentId }
    );
    return data.deployment;
  }

  /**
   * Poll until the latest deployment for a service succeeds, fails, or times out.
   *
   * @param {string} serviceId
   * @param {string} environmentId
   * @param {number} maxWaitMs  - Default 5 minutes
   * @returns {{ success: true, url: string, deploymentId: string }}
   * @throws Error on failure or timeout
   */
  async waitForDeployment(serviceId, environmentId, maxWaitMs = 300_000) {
    const start = Date.now();
    const TERMINAL_SUCCESS = ['SUCCESS'];
    const TERMINAL_FAIL = ['FAILED', 'CRASHED', 'REMOVED'];

    logger.info(`Polling Railway deployment for service ${serviceId}...`);

    while (Date.now() - start < maxWaitMs) {
      const data = await this.graphql(
        `query GetService($serviceId: String!, $envId: String!) {
          service(id: $serviceId) {
            serviceInstances(environmentId: $envId) {
              edges {
                node {
                  latestDeployment {
                    id
                    status
                  }
                  domains {
                    edges {
                      node { domain }
                    }
                  }
                }
              }
            }
          }
        }`,
        { serviceId, envId: environmentId }
      );

      const instance = data.service?.serviceInstances?.edges?.[0]?.node;
      const deployment = instance?.latestDeployment;
      const domain = instance?.domains?.edges?.[0]?.node?.domain;

      if (!deployment) {
        logger.info('Railway: no deployment yet, waiting...');
        await this.sleep(5000);
        continue;
      }

      logger.info(`Railway deployment status: ${deployment.status}`);

      if (TERMINAL_SUCCESS.includes(deployment.status)) {
        return {
          success: true,
          url: domain ? `https://${domain}` : null,
          deploymentId: deployment.id,
        };
      }

      if (TERMINAL_FAIL.includes(deployment.status)) {
        throw new Error(`Railway deployment ${deployment.status.toLowerCase()}`);
      }

      await this.sleep(5000);
    }

    throw new Error(`Railway deployment timed out after ${maxWaitMs / 1000}s`);
  }

  // ─── DOMAIN ─────────────────────────────────────────────────────────────────

  /**
   * Generate a Railway-provided *.up.railway.app domain for a service.
   * @param {string} serviceId
   * @param {string} environmentId
   * @returns {string}  Full https URL
   */
  async generateDomain(serviceId, environmentId) {
    logger.info(`Generating Railway domain for service ${serviceId}`);
    const data = await this.graphql(
      `mutation GenerateDomain($serviceId: String!, $environmentId: String!) {
        serviceDomainCreate(input: {
          serviceId: $serviceId
          environmentId: $environmentId
        }) {
          domain
        }
      }`,
      { serviceId, environmentId }
    );
    const domain = data.serviceDomainCreate?.domain;
    if (!domain) throw new Error('Railway did not return a domain after generation');
    logger.info(`Railway domain generated: https://${domain}`);
    return `https://${domain}`;
  }

  /**
   * Add a custom domain to a Railway service.
   * @param {string} serviceId
   * @param {string} environmentId
   * @param {string} customDomain  e.g. "api.myapp.com"
   * @returns {{ domain: string }}
   */
  async addCustomDomain(serviceId, environmentId, customDomain) {
    logger.info(`Adding custom domain ${customDomain} to service ${serviceId}`);
    const data = await this.graphql(
      `mutation AddCustomDomain(
        $serviceId: String!,
        $environmentId: String!,
        $domain: String!
      ) {
        customDomainCreate(input: {
          serviceId: $serviceId
          environmentId: $environmentId
          domain: $domain
        }) {
          domain
        }
      }`,
      { serviceId, environmentId, domain: customDomain }
    );
    return data.customDomainCreate;
  }

  // ─── TOKEN VALIDATION ───────────────────────────────────────────────────────

  /**
   * Validate that the stored token is accepted by Railway.
   * @returns {boolean}
   */
  async validateToken() {
    try {
      const data = await this.graphql(`query { me { id } }`);
      return !!data?.me?.id;
    } catch {
      return false;
    }
  }

  // ─── UTILS ──────────────────────────────────────────────────────────────────

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RailwayService;
