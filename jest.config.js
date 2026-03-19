/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/backend', '<rootDir>/agent', '<rootDir>/services'],
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  collectCoverageFrom: [
    'backend/**/*.js',
    'agent/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**',
    '!**/.env*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  setupFiles: ['<rootDir>/jest.setup.js']
};
