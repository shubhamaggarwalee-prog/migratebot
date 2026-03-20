/**
 * backend/services/replit.js
 * Replit source connector — authenticates with a user-supplied API token
 * to read files from public or private Repls.
 *
 * Replit GraphQL API: https://replit.com/graphql
 */
const axios = require('axios');
const logger = require('../utils/logger');

const GRAPHQL = 'https://replit.com/graphql';
const GIT_ARCHIVE = 'https://replit.com/@{username}/{slug}.tar.gz';

class ReplitService {
  /**
   * @param {string} apiToken  User's Replit API / connect token
   */
  constructor(apiToken) {
    if (!apiToken) throw new Error('Replit API token is required');
    this.token = apiToken;
    this.client = axios.create({
      baseURL: GRAPHQL,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'replit',
        // Replit uses a cookie-based session but also accepts bearer tokens
        // issued via their OAuth / personal token flow
        Authorization: `Bearer ${apiToken}`,
        Referer: 'https://replit.com',
        'User-Agent': 'MigrateBot/1.0',
      },
    });
  }

  // ─── GraphQL helper ────────────────────────────────────────────────────────
  async gql(query, variables = {}) {
    try {
      const { data } = await this.client.post('', { query, variables });
      if (data.errors?.length) {
        throw new Error(data.errors.map(e => e.message).join('; '));
      }
      return data.data;
    } catch (err) {
      if (err.response?.status === 401) throw new Error('Replit token is invalid or expired');
      if (err.response?.status === 403) throw new Error('Replit token does not have access to this repl');
      throw err;
    }
  }

  // ─── Auth: validate token + get current user ───────────────────────────────
  async getUser() {
    const data = await this.gql(`
      query CurrentUser {
        currentUser {
          id
          username
          displayName
          email
        }
      }
    `);
    if (!data?.currentUser) throw new Error('Replit token is invalid — currentUser returned null');
    return data.currentUser;
  }

  // ─── List repls for current user ──────────────────────────────────────────
  async listRepls(limit = 20) {
    const data = await this.gql(`
      query ListRepls($limit: Int) {
        currentUser {
          recentRepls(count: $limit) {
            id
            slug
            title
            isPrivate
            language
            description
            url
          }
        }
      }
    `, { limit });
    return data?.currentUser?.recentRepls ?? [];
  }

  // ─── Get repl metadata by slug ────────────────────────────────────────────
  async getReplInfo(username, slug) {
    const data = await this.gql(`
      query GetRepl($url: String!) {
        repl(url: $url) {
          id
          slug
          title
          isPrivate
          language
          description
          url
          user { username }
        }
      }
    `, { url: `/@${username}/${slug}` });
    if (!data?.repl) throw new Error(`Repl @${username}/${slug} not found or not accessible`);
    return data.repl;
  }

  // ─── Parse a Replit URL or slug into { username, slug } ───────────────────
  parseReplUrl(input) {
    // Accepts:
    //   https://replit.com/@alice/my-project
    //   @alice/my-project
    //   my-project  (assumes currentUser)
    const match = input.match(/(?:replit\.com\/)?@([\w-]+)\/([\w-]+)/);
    if (match) return { username: match[1], slug: match[2] };
    // bare slug — caller must supply username separately
    return { username: null, slug: input.replace(/^@/, '').split('/').pop() };
  }

  // ─── Read all source files from a Repl ────────────────────────────────────
  /**
   * Uses the Replit GraphQL files API to list & download files.
   * Falls back to archive download if GraphQL file API is unavailable.
   *
   * @returns {Array<{ path: string, content: string, size: number }>}
   */
  async readFiles(username, slug) {
    logger.info(`Reading Replit files: @${username}/${slug}`);
    let files = [];

    try {
      files = await this._readViaGraphQL(username, slug);
    } catch (gqlErr) {
      logger.warn(`Replit GraphQL file read failed (${gqlErr.message}), trying archive download`);
      files = await this._readViaArchive(username, slug);
    }

    logger.info(`Read ${files.length} files from @${username}/${slug}`);
    return files;
  }

  async _readViaGraphQL(username, slug) {
    // Replit exposes a replFiles query on newer API versions
    const data = await this.gql(`
      query GetReplFiles($url: String!) {
        repl(url: $url) {
          id
          files {
            name
            content
          }
        }
      }
    `, { url: `/@${username}/${slug}` });

    const rawFiles = data?.repl?.files ?? [];
    if (rawFiles.length === 0) throw new Error('No files returned via GraphQL');

    return rawFiles
      .filter(f => f.content !== null && !this._isBinary(f.name))
      .map(f => ({
        path: f.name,
        content: f.content,
        size: Buffer.byteLength(f.content, 'utf8'),
      }));
  }

  async _readViaArchive(username, slug) {
    // Download .tar.gz snapshot (works for public repls; private ones need auth cookie)
    const url = GIT_ARCHIVE.replace('{username}', username).replace('{slug}', slug);
    const { data } = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Referer: 'https://replit.com',
      },
      timeout: 30000,
    });
    return this._extractTarGz(data);
  }

  // ─── Tar.gz extraction helper ─────────────────────────────────────────────
  async _extractTarGz(buffer) {
    const zlib = require('zlib');
    const { promisify } = require('util');
    const gunzip = promisify(zlib.gunzip);

    const inflated = await gunzip(buffer);
    const files = [];
    let offset = 0;

    while (offset < inflated.length - 512) {
      const header = inflated.slice(offset, offset + 512);
      const fileName = header.slice(0, 100).toString('utf8').replace(/\0/g, '').trim();
      if (!fileName) break;
      const fileSizeOctal = header.slice(124, 136).toString('utf8').replace(/\0/g, '').trim();
      const fileSize = parseInt(fileSizeOctal, 8) || 0;
      offset += 512;
      const content = inflated.slice(offset, offset + fileSize).toString('utf8');
      const cleanPath = fileName.replace(/^\.\//,'').replace(/^[^/]+\//,''); // strip tar root dir
      if (cleanPath && fileSize > 0 && !this._isBinary(cleanPath)) {
        files.push({ path: cleanPath, content, size: fileSize });
      }
      offset += Math.ceil(fileSize / 512) * 512;
    }
    return files;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  _isBinary(filename) {
    const BINARY_EXT = new Set([
      'png','jpg','jpeg','gif','webp','ico','svg','woff','woff2','ttf','eot',
      'otf','mp4','webm','ogg','mp3','wav','pdf','zip','gz','tar','bin',
      'exe','dll','so','dylib','lock', // package-lock etc handled by content
    ]);
    const ext = filename.split('.').pop().toLowerCase();
    return BINARY_EXT.has(ext);
  }
}

module.exports = ReplitService;
