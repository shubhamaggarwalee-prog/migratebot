/**
 * pages/api/migrations/validate-source.js
 *
 * Validates that a source project URL exists and is accessible
 * before the user moves to Step 2 of the migration wizard
 */

const ReplitService = require('../../../services/replit');
const EmergentService = require('../../../services/emergent');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, url } = req.body;
  if (!platform || !url) return res.status(400).json({ error: 'platform and url are required' });

  try {
    switch (platform) {
      case 'github': {
        const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
        if (!match) throw new Error('Invalid GitHub URL');
        const [, owner, repo] = match;
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {},
        });
        if (!r.ok) throw new Error('GitHub repo not found or is private');
        break;
      }
      case 'replit': {
        const projectId = ReplitService.extractProjectId(url);
        await ReplitService.fetchProjectFiles(projectId);
        break;
      }
      case 'emergent': {
        const projectId = EmergentService.extractProjectId(url);
        await EmergentService.fetchProjectInfo(projectId);
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid platform. Must be github, replit, or emergent' });
    }
    return res.status(200).json({ valid: true });
  } catch (err) {
    return res.status(400).json({ valid: false, error: err.message });
  }
}
