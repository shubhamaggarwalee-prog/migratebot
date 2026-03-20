/**
 * backend/services/emergent.js
 * Emergent platform stub — extend when Emergent exposes a public API.
 * For now treats the project URL as a plain git clone source.
 */

class EmergentService {
  constructor(token) {
    this.token = token;
  }

  static async cloneProject(sourceUrl) {
    // Stub: return a minimal project descriptor so the analyzer can proceed
    const slug = sourceUrl.split('/').pop() || 'emergent-project';
    return {
      name: slug,
      config: { template: 'unknown' },
      structure: { hasWeb: true, hasApi: true, hasDb: false },
      deploymentTargets: {
        vercel:  { source: 'web' },
        railway: { source: 'api' },
      },
      files: [],
    };
  }
}

module.exports = EmergentService;
