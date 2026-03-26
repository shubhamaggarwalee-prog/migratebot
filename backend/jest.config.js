/**
 * backend/jest.config.js
 *
 * setupFiles runs BEFORE any module is required, so env vars are in place
 * when database.js / billing.js / supabase.js etc throw at require-time
 * if their required keys are missing.
 */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  forceExit: true,
  testTimeout: 15000,
};
