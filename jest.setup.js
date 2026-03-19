// jest.setup.js — sets dummy env vars for tests so modules don't throw on import
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.NODE_ENV = 'test';
