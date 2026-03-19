/**
 * services/replit.js
 *
 * Handles cloning and analyzing Replit projects
 * Replit projects are typically monoliths with frontend + backend together
 * We detect the structure and suggest how to split for deployment
 */

class ReplitService {
  static extractProjectId(url) {
    const match = url.match(/replit\.com\/@([\w-]+)\/([\w-]+)/);
    if (!match) throw new Error('Invalid Replit URL format');
    return { username: match[1], projectName: match[2] };
  }

  static async fetchProjectFiles(projectId) {
    const { username, projectName } = projectId;
    const apiUrl = `https://replit.com/api/v0/data/read/${username}/${projectName}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Replit project not found: ${username}/${projectName}`);
      const data = await response.json();
      return data.files || {};
    } catch (err) {
      throw new Error(`Failed to fetch Replit project: ${err.message}`);
    }
  }

  static parseReplitConfig(files) {
    const replitFile = files['.replit'] || files['replit.nix'];
    if (!replitFile) return { runCommand: 'npm start', language: 'unknown', packageManager: 'npm' };
    const content = replitFile.content || '';
    const runMatch = content.match(/run\s*=\s*"([^"]+)"/);
    const runCommand = runMatch ? runMatch[1] : 'npm start';
    let language = 'unknown', packageManager = 'npm';
    if (content.includes('python')) { language = 'python'; packageManager = 'pip'; }
    else if (content.includes('nodejs') || content.includes('node')) { language = 'node'; packageManager = 'npm'; }
    else if (content.includes('ruby')) { language = 'ruby'; packageManager = 'bundle'; }
    return { runCommand, language, packageManager };
  }

  static analyzeProjectStructure(files) {
    const fileNames = Object.keys(files);
    const packageJson = files['package.json'];
    let hasReact = false, hasVue = false, hasNext = false;
    let hasExpress = false, hasFastify = false, hasFlask = false;
    if (packageJson) {
      const deps = packageJson.content || '';
      hasReact = deps.includes('react');
      hasVue = deps.includes('vue');
      hasNext = deps.includes('next');
      hasExpress = deps.includes('express');
      hasFastify = deps.includes('fastify');
    }
    const requirementsTxt = files['requirements.txt'];
    if (requirementsTxt) {
      const content = requirementsTxt.content || '';
      hasFlask = content.includes('flask');
    }
    const hasFrontendDir = fileNames.some(f => f.startsWith('src/') || f.startsWith('public/') || f.startsWith('components/'));
    const hasBackendDir = fileNames.some(f => f.startsWith('server/') || f.startsWith('api/') || f.startsWith('routes/'));
    const hasDbDir = fileNames.some(f => f.startsWith('db/') || f.startsWith('migrations/') || f.startsWith('prisma/'));
    const isMonolith = (hasReact || hasVue || hasNext) && (hasExpress || hasFastify || hasFlask);
    return {
      isMonolith,
      frameworks: {
        frontend: hasNext ? 'Next.js' : hasReact ? 'React' : hasVue ? 'Vue' : null,
        backend: hasExpress ? 'Express' : hasFastify ? 'Fastify' : hasFlask ? 'Flask' : null,
      },
      hasDatabase: hasDbDir,
      directories: { hasFrontendDir, hasBackendDir, hasDbDir },
    };
  }

  static async cloneProject(url) {
    try {
      const projectId = this.extractProjectId(url);
      const files = await this.fetchProjectFiles(projectId);
      const config = this.parseReplitConfig(files);
      const structure = this.analyzeProjectStructure(files);
      return {
        projectId: `${projectId.username}/${projectId.projectName}`,
        url,
        config,
        structure,
        files: Object.keys(files).slice(0, 50),
        metadata: {
          isMonolith: structure.isMonolith,
          requiresSplitting: structure.isMonolith,
          suggestedSplit: structure.isMonolith ? { vercel: 'Frontend + API routes', railway: 'Backend services + database' } : null,
        },
      };
    } catch (err) {
      throw new Error(`Failed to clone Replit project: ${err.message}`);
    }
  }

  static async validateProject(url) {
    try {
      const projectId = this.extractProjectId(url);
      await this.fetchProjectFiles(projectId);
      return true;
    } catch (err) {
      throw new Error('Replit project not found or not accessible');
    }
  }
}

module.exports = ReplitService;
