/**
 * backend/utils/db.js — DELETED
 *
 * This file is intentionally empty. It has been replaced by backend/utils/database.js
 * which is the canonical Supabase client for this project.
 *
 * Any file that previously imported from utils/db.js should now import from utils/database.js:
 *
 *   const { supabase, supabaseAdmin, initSchema } = require('./database');
 *
 * This stub is kept temporarily to prevent require() errors during deployment.
 * Remove it after verifying no live imports remain.
 */
const database = require('./database');
module.exports = database;
