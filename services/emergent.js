/**
 * services/emergent.js
 *
 * Handles cloning and analyzing Emergent projects
 * Emergent projects have clear separation: /web, /api, /db directories
 * We detect them and suggest deployment across Vercel/Railway/Supabase
 */

class EmergentService {
  static extractProjectId(url) {
    const match1 = url.match(/emergent\.dev\/project\/([\w-]+)/);
    if (match1) return { id: match1[1], type: 'projectid' };
    const match2 = url.match(/emergent\.dev\/@([\w-]+)\/([\w-]+)/);
    if (match2) return { username: match2[1], projectName: match2[2], type: 'username' };
    throw new Error('Invalid Emergent URL format');
  }

  static async fetchProjectInfo(projectId) {
    try {
      let apiUrl;
      if (projectId.type === 'projectid') {
        apiUrl = `https://api.emergent.dev/v1/projects/${projectId.id}`;
      } else {
        apiUrl = `https://api.emergent.dev/v1/users/${projectId.username}/projects/${projectId.projectName}`;
      }
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Emergent project not found');
      return await response.json();
    } catch (err) {
      throw new Error(`Failed to fetch Emergent project: ${err.message}`);
    }
  }

  static parseEmergentConfig(projectInfo) {
    const config = projectInfo.config || {};
    return {
      name: projectInfo.name,
      description: projectInfo.description,
      template: config.template || 'custom',
      hasWeb: config.hasWeb !== false,
      hasApi: config.hasApi !== false,
      hasDb: config.hasDb !== false,
      webFramework: config.webFramework || 'next',
      apiFramework: config.apiFramework || 'express',
      dbType: config.dbType || 'postgres',
    };
  }

  static analyzeProjectStructure(projectInfo) {
    const files = projectInfo.files || [];
    const hasWeb = files.some(f => f.startsWith('web/'));
    const hasApi = files.some(f => f.startsWith('api/'));
    const hasDb = files.some(f => f.startsWith('db/'));
    const hasShared = files.some(f => f.startsWith('shared/'));
    return {
      hasWeb, hasApi, hasDb, hasShared,
      frameworks: { web: 'next', api: 'express', db: 'postgres' },
    };
  }

  static suggestDeploymentTargets(projectInfo) {
    const analysis = this.analyzeProjectStructure(projectInfo);
    return {
      vercel: { what: 'Frontend application', source: 'web/', framework: analysis.frameworks.web },
      railway: { what: 'Backend API + jobs', source: 'api/', framework: analysis.frameworks.api },
      supabase: { what: 'Database + authentication', source: 'db/', type: analysis.frameworks.db },
    };
  }

  static async cloneProject(url) {
    try {
      const projectId = this.extractProjectId(url);
      const projectInfo = await this.fetchProjectInfo(projectId);
      const config = this.parseEmergentConfig(projectInfo);
      const structure = this.analyzeProjectStructure(projectInfo);
      const deployment = this.suggestDeploymentTargets(projectInfo);
      return {
        projectId: projectInfo.id,
        url,
        name: projectInfo.name,
        config,
        structure,
        deploymentTargets: deployment,
        files: (projectInfo.files || []).slice(0, 50),
        metadata: {
          isModular: structure.hasWeb && structure.hasApi,
          requiresDb: structure.hasDb,
          complexity: 'low',
          estimatedTime: '45-90 minutes',
        },
      };
    } catch (err) {
      throw new Error(`Failed to clone Emergent project: ${err.message}`);
    }
  }

  static async validateProject(url) {
    try {
      const projectId = this.extractProjectId(url);
      await this.fetchProjectInfo(projectId);
      return true;
    } catch (err) {
      throw new Error('Emergent project not found or not accessible');
    }
  }
}

module.exports = EmergentService;
