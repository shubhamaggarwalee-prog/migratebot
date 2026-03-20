/**
 * backend/agent/analyzer.js
 *
 * CodeAnalyzer — used by migrationRunner to analyse cloned files.
 * Also exposes static AnalyzerAgent.analyze() for the /analyze route.
 */

const Anthropic = require('@anthropic-ai/sdk');

// ─── CodeAnalyzer (used by migrationRunner) ───────────────────────────────────
// Receives an array of { path, content } file objects already fetched by the
// source adapter, runs Claude analysis, returns a structured analysis object.

class CodeAnalyzer {
  async analyze(files, platforms = []) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    // Build a compact file listing for the prompt (cap at 60 files / 8 KB each)
    const fileSummary = files
      .slice(0, 60)
      .map(f => `### ${f.path}\n${(f.content || '').slice(0, 8000)}`)
      .join('\n\n');

    const prompt = `You are a senior software engineer. Analyse this codebase and return ONLY a JSON object.

Files:
${fileSummary}

Target platforms: ${platforms.join(', ') || 'auto-detect'}

Return ONLY valid JSON — no markdown, no explanation:
{
  "framework": "next|react|vue|angular|express|fastify|django|flask|rails|other",
  "language": "typescript|javascript|python|ruby|go|other",
  "database": "postgres|mysql|mongodb|sqlite|supabase|firebase|none|unknown",
  "databaseType": "postgres|mysql|mongodb|sqlite|none|unknown",
  "auth": "supabase|auth0|nextauth|custom|none|unknown",
  "hasStripe": true,
  "hasRedis": false,
  "deployTarget": "vercel|railway|both",
  "supabaseSchema": null,
  "databaseSchema": null,
  "confidenceScore": 85,
  "migrationTasks": ["task1", "task2"],
  "risks": ["risk1"],
  "recommendations": ["rec1"]
}`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Claude returned invalid JSON during analysis');
    }
  }

  async generateSupabaseMigration(schema, dbType) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Convert this ${dbType} schema to a Supabase-compatible PostgreSQL migration SQL.\nReturn ONLY the SQL, no explanation.\n\nSchema:\n${schema}`,
      }],
    });
    return message.content[0].text.trim();
  }
}

// ─── AnalyzerAgent (used by /api/migrations/:id/analyze route) ────────────────
// Static class that accepts a URL + platform string (not pre-fetched files).

class AnalyzerAgent {
  static async analyze(sourceUrl, sourcePlatform, anthropicApiKey) {
    const key = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    switch (sourcePlatform) {
      case 'replit':   return this.analyzeUrl(sourceUrl, 'replit', key);
      case 'emergent': return this.analyzeUrl(sourceUrl, 'emergent', key);
      case 'github':
      default:         return this.analyzeGithub(sourceUrl, key);
    }
  }

  static async analyzeGithub(sourceUrl, apiKey) {
    const repoMatch = sourceUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!repoMatch) throw new Error('Invalid GitHub URL');
    const [, owner, repo] = repoMatch;

    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) throw new Error('GitHub repo not found or private');
    const repoData = await repoRes.json();

    let packageJson = null;
    try {
      const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`);
      if (pkgRes.ok) packageJson = await pkgRes.json();
    } catch (_) {}

    return this._callClaude(
      `Analyse this GitHub repo and return ONLY valid JSON.\n\nRepo: ${owner}/${repo}\nLanguage: ${repoData.language}\nDescription: ${repoData.description}\nDependencies: ${packageJson ? JSON.stringify(packageJson.dependencies || {}) : 'N/A'}\n\n{"framework":"","language":"","database":"","auth":"","hasStripe":false,"hasRedis":false,"deployTarget":"both","confidenceScore":80,"risks":[],"recommendations":[]}`,
      apiKey
    );
  }

  static async analyzeUrl(sourceUrl, platform, apiKey) {
    return this._callClaude(
      `Analyse this ${platform} project URL and return ONLY valid JSON.\n\nURL: ${sourceUrl}\n\n{"framework":"","language":"","database":"","auth":"","hasStripe":false,"hasRedis":false,"deployTarget":"both","confidenceScore":60,"risks":["Manual review recommended"],"recommendations":[]}`,
      apiKey
    );
  }

  static async _callClaude(prompt, apiKey) {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].text.trim();
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Claude returned invalid JSON');
    }
  }
}

module.exports = AnalyzerAgent;
module.exports.CodeAnalyzer = CodeAnalyzer;
module.exports.AnalyzerAgent = AnalyzerAgent;
