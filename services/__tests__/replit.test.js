/**
 * services/__tests__/replit.test.js
 */
const ReplitService = require('../replit');

describe('ReplitService', () => {
  describe('extractProjectId', () => {
    it('parses valid Replit URL', () => {
      const result = ReplitService.extractProjectId('https://replit.com/@johndoe/my-project');
      expect(result.username).toBe('johndoe');
      expect(result.projectName).toBe('my-project');
    });

    it('throws on invalid URL', () => {
      expect(() => ReplitService.extractProjectId('https://github.com/user/repo')).toThrow('Invalid Replit URL');
    });
  });

  describe('parseReplitConfig', () => {
    it('detects node language from .replit', () => {
      const files = { '.replit': { content: 'run = "node index.js"\nlanguage = "nodejs"' } };
      const config = ReplitService.parseReplitConfig(files);
      expect(config.runCommand).toBe('node index.js');
      expect(config.language).toBe('node');
    });

    it('returns defaults when no .replit file', () => {
      const config = ReplitService.parseReplitConfig({});
      expect(config.runCommand).toBe('npm start');
      expect(config.language).toBe('unknown');
    });
  });

  describe('analyzeProjectStructure', () => {
    it('detects monolith with react + express', () => {
      const files = { 'package.json': { content: '{"dependencies":{"react":"18","express":"4"}}' } };
      const result = ReplitService.analyzeProjectStructure(files);
      expect(result.isMonolith).toBe(true);
      expect(result.frameworks.frontend).toBe('React');
      expect(result.frameworks.backend).toBe('Express');
    });

    it('does not flag backend-only as monolith', () => {
      const files = { 'package.json': { content: '{"dependencies":{"express":"4"}}' } };
      const result = ReplitService.analyzeProjectStructure(files);
      expect(result.isMonolith).toBe(false);
    });
  });
});
