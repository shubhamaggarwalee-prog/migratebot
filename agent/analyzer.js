/**
 * agent/analyzer.js
 *
 * Multi-source analyzer — routes to correct service
 * based on the source platform (github, replit, emergent)
 * Uses Claude Opus to analyze project structure
 */

const ReplitService = require('../services/replit');
const EmergentService = require('../services/emergent');

class AnalyzerAgent {
  /**
   * Main router — calls the correct analyzer
   * @param {string} sourceUrl - URL of the project
   * @param {string} sourcePlatform - 'github' | 'replit' | 'emergent'
   * @param {string} anthropicApiKey - Claude API key
   */
  static async analyze(sourceUrl, sourcePlatform, anthropicApiKey) {
    switch (sourcePlatform) {
      case 'github':
        return this.analyzeGithub(sourceUrl, anthropicApiKey);
      case 'replit':
        return this.analyzeReplit(sourceUrl, anthropicApiKey);
      case 'emergent':
        return this.analyzeEmergent(sourceUrl, anthropicApiKey);
      default:
        throw new Error(`Unknown source platform: ${sourcePlatform}`);
    }
  }

  static async analyzeGithub(sourceUrl, anthropicApiKey) {
    const repoMatch = sourceUrl.match(/github\.com\/([\w-]+)\/([\w-]+)/);
    if (!repoMatch) throw new Error('Invalid GitHub URL');
    const [, owner, repo] = repoMatch;

    // Fetch repo metadata from GitHub API
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) throw new Error('GitHub repo not found or private');
    const repoData = await repoRes.json();

    // Fetch package.json if exists
    let packageJson = null;
    try {
      const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`);
      if (pkgRes.ok) packageJson = await pkgRes.json();
    } catch (_) {}

    // Send to Claude for analysis
    const prompt = `Analyze this GitHub repository and return a JSON object.

Repository: ${owner}/${repo}
Language: ${repoData.language}
Description: ${repoData.description}
Topics: ${(repoData.topics || []).join(', ')}
Package.json dependencies: ${packageJson ? JSON.stringify(packageJson.dependencies || {}) : 'N/A'}

Return ONLY valid JSON:
{
  "framework": "next|react|vue|angular|express|fastify|django|flask|rails|other",
  "language": "typescript|javascript|python|ruby|go|other",
  "database": "postgres|mysql|mongodb|sqlite|supabase|firebase|none|unknown",
  "auth": "supabase|auth0|nextauth|custom|none|unknown",
  "hasStripe": true|false,
  "hasRedis": true|false,
  "deployTarget": "vercel|railway|both",
  "confidenceScore": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"]
}`;

    const analysis = await this.callClaude(prompt, anthropicApiKey);
    return { ...analysis, sourcePlatform: 'github', repoUrl: sourceUrl };
  }

  static async analyzeReplit(sourceUrl, anthropicApiKey) {
    const projectData = await ReplitService.cloneProject(sourceUrl);

    const prompt = `Analyze this Replit project and return a JSON object.

Project: ${projectData.projectId}
Run command: ${projectData.config.runCommand}
Language: ${projectData.config.language}
Is monolith: ${projectData.structure.isMonolith}
Frontend framework: ${projectData.structure.frameworks.frontend || 'none'}
Backend framework: ${projectData.structure.frameworks.backend || 'none'}
Files: ${projectData.files.slice(0, 20).join(', ')}

IMPORTANT: This is a Replit project which is typically a monolith.
Suggest how to split it for deployment to Vercel (frontend) and Railway (backend).

Return ONLY valid JSON:
{
  "framework": "detected framework",
  "language": "detected language",
  "isMonolith": true|false,
  "splitStrategy": "description of how to split the monolith",
  "vercelFiles": ["list of files/dirs for Vercel"],
  "railwayFiles": ["list of files/dirs for Railway"],
  "database": "postgres|mysql|mongodb|sqlite|none|unknown",
  "confidenceScore": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"]
}`;

    const analysis = await this.callClaude(prompt, anthropicApiKey);
    return { ...analysis, sourcePlatform: 'replit', repoUrl: sourceUrl, projectData };
  }

  static async analyzeEmergent(sourceUrl, anthropicApiKey) {
    const projectData = await EmergentService.cloneProject(sourceUrl);

    const prompt = `Analyze this Emergent project and return a JSON object.

Project: ${projectData.name}
Template: ${projectData.config.template}
Has web (/web dir): ${projectData.structure.hasWeb}
Has api (/api dir): ${projectData.structure.hasApi}
Has db (/db dir): ${projectData.structure.hasDb}
Suggested targets: Vercel=${projectData.deploymentTargets.vercel.source}, Railway=${projectData.deploymentTargets.railway.source}

Return ONLY valid JSON:
{
  "template": "detected template",
  "webFramework": "next|react|vue|other",
  "apiFramework": "express|fastify|hono|other",
  "database": "postgres|mysql|mongodb|supabase|other",
  "deploymentTargets": {
    "frontend": "vercel",
    "backend": "railway",
    "database": "supabase"
  },
  "confidenceScore": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"]
}`;

    const analysis = await this.callClaude(prompt, anthropicApiKey);
    return { ...analysis, sourcePlatform: 'emergent', repoUrl: sourceUrl, projectData };
  }

  static async callClaude(prompt, apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error('Claude analysis failed');
    const data = await res.json();
    const text = data.content[0].text.trim();

    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Claude returned invalid JSON');
    }
  }
}

module.exports = AnalyzerAgent;
