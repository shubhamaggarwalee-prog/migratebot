/**
 * backend/services/migrationAgent.js
 *
 * Task 19: AI Migration Agent — wraps Claude to provide:
 *   • preScan()   — plain-English health report before/during analysis
 *   • autoFix()   — attempt to auto-fix a failed step, or ask the user
 *   • chat()      — interactive mid-migration conversation
 *
 * All Anthropic calls use claude-sonnet-4-6.
 */
const Anthropic = require('@anthropic-ai/sdk');
const logger    = require('../utils/logger');

const MODEL = 'claude-sonnet-4-6';

class MigrationAgent {
  /**
   * @param {string} apiKey      — user's decrypted Anthropic key
   * @param {object|null} io     — socket.io server instance (may be null in chat route)
   * @param {string} migrationId
   */
  constructor(apiKey, io, migrationId) {
    this.client      = new Anthropic({ apiKey });
    this.io          = io;
    this.migrationId = migrationId;
    this.files       = {};   // { 'path/to/file.js': 'content' }
    this.analysis    = null;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  _broadcast(event, payload) {
    if (this.io) {
      this.io.to(`migration:${this.migrationId}`).emit(event, payload);
    }
  }

  async _ask(systemPrompt, userPrompt, maxTokens = 1024) {
    const response = await this.client.messages.create({
      model:      MODEL,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return response.content?.[0]?.text || '';
  }

  _safeJson(text) {
    try {
      // Strip markdown code fences if Claude wraps the JSON
      const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }

  _filesSummary() {
    const paths = Object.keys(this.files);
    return paths.slice(0, 30).join(', ') + (paths.length > 30 ? ` … (+${paths.length - 30} more)` : '');
  }

  // ─── preScan ────────────────────────────────────────────────────────────────

  /**
   * Called right after Step 1 analysis completes.
   * Broadcasts an `agent:prescan` socket event and returns the report object.
   *
   * @param {object} files    — { 'path': 'content' } map from cloneSource
   * @param {object} analysis — result from CodeAnalyzer.analyze()
   * @returns {{ status, autoFixes, needsFromUser, summary }}
   */
  async preScan(files, analysis) {
    this.files    = files    || {};
    this.analysis = analysis || {};

    const system = [
      'You are MigrateBot\'s pre-flight AI assistant.',
      'Your job is to quickly review a codebase analysis and tell a non-technical user what to expect.',
      'Always use plain English — no jargon, no code blocks, no technical terms.',
      'Return ONLY a JSON object — no prose, no markdown around it.',
    ].join('\n');

    const user = [
      `Framework: ${analysis.framework || 'unknown'}, Language: ${analysis.language || 'unknown'}`,
      `Files: ${this._filesSummary()}`,
      `Migration tasks detected: ${JSON.stringify(analysis.migrationTasks || [])}`,
      `Database schema detected: ${analysis.databaseSchema ? 'yes' : 'no'}`,
      `Environment variables needed: ${JSON.stringify(analysis.envVars || [])}`,
      '',
      'Return a JSON object with exactly these keys:',
      '  "status": one of "ready" | "warnings" | "needs-input"',
      '  "autoFixes": array of strings — things we will handle automatically (keep each under 10 words)',
      '  "needsFromUser": array of strings — things the user must provide or decide',
      '  "summary": one sentence plain-English summary of the app and its readiness',
    ].join('\n');

    let report = { status: 'ready', autoFixes: [], needsFromUser: [], summary: 'Your app looks ready to deploy.' };
    try {
      const raw    = await this._ask(system, user, 800);
      const parsed = this._safeJson(raw);
      if (parsed && parsed.status) report = parsed;
    } catch (err) {
      logger.warn(`MigrationAgent.preScan failed: ${err.message}`);
    }

    this._broadcast('agent:prescan', report);
    return report;
  }

  // ─── autoFix ────────────────────────────────────────────────────────────────

  /**
   * Called when a deployment step throws an error.
   * Returns { action: 'fix', patch?, explanation } or { action: 'ask', question, explanation }
   *
   * If action === 'fix', the caller should apply patch (if any) and retry the step.
   * If action === 'ask', the caller should broadcast `agent:chat-needed` and pause.
   *
   * @param {string} errorMessage — the raw error from the failed step
   * @param {string} stepName     — 'supabase' | 'railway' | 'vercel'
   * @param {object} context      — extra context (projectId, repoName, etc.)
   * @returns {{ action, explanation, patch?, question? }}
   */
  async autoFix(errorMessage, stepName, context = {}) {
    const system = [
      'You are MigrateBot\'s auto-repair AI. A deployment step has failed.',
      'Your job is to decide: can you fix this automatically, or do you need to ask the user something?',
      'Always use plain English in explanations and questions — assume the user is NOT a developer.',
      'Return ONLY a JSON object — no prose, no markdown around it.',
    ].join('\n');

    const user = [
      `Failed step: ${stepName}`,
      `Error: ${errorMessage}`,
      `Framework: ${this.analysis?.framework || 'unknown'}`,
      `Language: ${this.analysis?.language || 'unknown'}`,
      `Files: ${this._filesSummary()}`,
      `Extra context: ${JSON.stringify(context)}`,
      '',
      'Return a JSON object with exactly these keys:',
      '  "action": "fix" if you can resolve this automatically, "ask" if you need user input',
      '  "explanation": plain English — what went wrong (max 2 sentences)',
      '  "patch": (only if action==="fix") object with "file" (path) and "content" (full fixed file content)',
      '  "question": (only if action==="ask") plain English question for the user (max 2 sentences)',
      '  "retryStep": true if the step should be retried after the fix/answer',
    ].join('\n');

    let result = {
      action:      'ask',
      explanation: `Something went wrong during the ${stepName} step.`,
      question:    `I hit an unexpected problem setting up ${stepName}. Could you check your ${stepName} credentials are correct and try again?`,
      retryStep:   false,
    };

    try {
      const raw    = await this._ask(system, user, 2000);
      const parsed = this._safeJson(raw);
      if (parsed && parsed.action) result = parsed;
    } catch (err) {
      logger.warn(`MigrationAgent.autoFix failed: ${err.message}`);
    }

    if (result.action === 'fix' && result.patch?.file && result.patch?.content) {
      this.files[result.patch.file] = result.patch.content;
      logger.info(`MigrationAgent: applied auto-patch to ${result.patch.file}`);
    }

    if (result.action === 'ask') {
      this._broadcast('agent:chat-needed', {
        question:    result.question,
        explanation: result.explanation,
        stepName,
      });
    }

    return result;
  }

  // ─── chat ───────────────────────────────────────────────────────────────────

  /**
   * Handles one conversational turn during a paused migration.
   * Called by the /api/agent/chat route.
   *
   * @param {Array}  messages        — [{ role: 'user'|'assistant', content: string }]
   * @param {object} migrationContext — { repourl, framework, language, stepName, explanation }
   * @returns {{ reply: string, resolved: boolean, skipStep: boolean }}
   */
  async chat(messages, migrationContext = {}) {
    const { repourl, framework, language, stepName, explanation } = migrationContext;

    const system = [
      'You are MigrateBot\'s migration assistant, embedded in a live deployment wizard.',
      `The user's app is at ${repourl || 'unknown'} (${framework || 'unknown'} / ${language || 'unknown'}).`,
      stepName ? `The "${stepName}" deployment step has paused and needs user input.` : '',
      explanation ? `Context: ${explanation}` : '',
      '',
      'Your job is to help the user unblock the migration.',
      'Always use plain English — assume the user is NOT a developer.',
      'Keep replies short (max 4 sentences). Use numbered steps if giving instructions.',
      'If the user has provided what was needed (credentials, a decision, confirmation), end your reply with exactly: [RESOLVED]',
      'If the user says to skip this step, end your reply with exactly: [SKIP]',
      'Otherwise just answer helpfully and ask for what you need.',
    ].filter(Boolean).join('\n');

    let replyText = 'I\'m here to help! Could you tell me a bit more about what you\'d like to do?';

    try {
      const response = await this.client.messages.create({
        model:      MODEL,
        max_tokens: 600,
        system,
        messages:   messages.map(m => ({
          role:    m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
        })),
      });
      replyText = response.content?.[0]?.text || replyText;
    } catch (err) {
      logger.warn(`MigrationAgent.chat failed: ${err.message}`);
    }

    const resolved = replyText.includes('[RESOLVED]');
    const skipStep = replyText.includes('[SKIP]');

    // Strip the signal tokens from the displayed reply
    const cleanReply = replyText
      .replace('[RESOLVED]', '')
      .replace('[SKIP]', '')
      .trim();

    return { reply: cleanReply, resolved, skipStep };
  }
}

module.exports = MigrationAgent;
