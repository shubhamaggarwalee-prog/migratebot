/**
 * backend/__tests__/health.test.js
 */
const request = require('supertest');
const { app } = require('../server');

describe('Health Routes', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('2.0.0');
  });
});
