/**
 * services/__tests__/emergent.test.js
 */
const EmergentService = require('../emergent');

describe('EmergentService', () => {
  describe('extractProjectId', () => {
    it('parses project ID URL', () => {
      const result = EmergentService.extractProjectId('https://emergent.dev/project/abc-123');
      expect(result.id).toBe('abc-123');
      expect(result.type).toBe('projectid');
    });

    it('parses username/project URL', () => {
      const result = EmergentService.extractProjectId('https://emergent.dev/@johndoe/my-app');
      expect(result.username).toBe('johndoe');
      expect(result.projectName).toBe('my-app');
      expect(result.type).toBe('username');
    });

    it('throws on invalid URL', () => {
      expect(() => EmergentService.extractProjectId('https://github.com/user/repo')).toThrow('Invalid Emergent URL');
    });
  });

  describe('analyzeProjectStructure', () => {
    it('detects web, api, db directories', () => {
      const info = { files: ['web/index.js', 'api/server.js', 'db/schema.sql'] };
      const result = EmergentService.analyzeProjectStructure(info);
      expect(result.hasWeb).toBe(true);
      expect(result.hasApi).toBe(true);
      expect(result.hasDb).toBe(true);
    });

    it('handles empty file list', () => {
      const result = EmergentService.analyzeProjectStructure({ files: [] });
      expect(result.hasWeb).toBe(false);
      expect(result.hasApi).toBe(false);
    });
  });

  describe('suggestDeploymentTargets', () => {
    it('returns vercel, railway, supabase targets', () => {
      const info = { files: ['web/page.jsx', 'api/routes.js', 'db/schema.sql'] };
      const targets = EmergentService.suggestDeploymentTargets(info);
      expect(targets.vercel.source).toBe('web/');
      expect(targets.railway.source).toBe('api/');
      expect(targets.supabase.source).toBe('db/');
    });
  });
});
