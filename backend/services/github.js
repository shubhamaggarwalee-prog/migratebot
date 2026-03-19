/**
 * backend/services/github.js
 * GitHub repo interaction via GitHub API
 */
const { Octokit } = require('@octokit/rest');

class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({ auth: token || process.env.GITHUB_TOKEN });
  }

  static extractRepoInfo(url) {
    const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!match) throw new Error('Invalid GitHub URL');
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }

  async getRepo(url) {
    const { owner, repo } = GitHubService.extractRepoInfo(url);
    const { data } = await this.octokit.repos.get({ owner, repo });
    return data;
  }

  async getFileContents(owner, repo, path, ref = 'main') {
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo, path, ref });
      if (data.type === 'file') return Buffer.from(data.content, 'base64').toString('utf8');
      return null;
    } catch { return null; }
  }

  async getPackageJson(owner, repo, ref = 'main') {
    const content = await this.getFileContents(owner, repo, 'package.json', ref);
    if (!content) return null;
    try { return JSON.parse(content); } catch { return null; }
  }

  async listFiles(owner, repo, ref = 'main', path = '') {
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo, path, ref });
      return Array.isArray(data) ? data.map(f => f.path) : [];
    } catch { return []; }
  }

  async forkRepo(owner, repo, targetOrg) {
    const { data } = await this.octokit.repos.createFork({ owner, repo, organization: targetOrg });
    return data;
  }
}

module.exports = GitHubService;
