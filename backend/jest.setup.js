/**
 * backend/jest.setup.js
 *
 * Loaded by Jest BEFORE any test file or module is imported.
 * Sets stub values for every env var that causes a module-level throw
 * when missing (Supabase, Stripe, SendGrid, etc.).
 *
 * These are fake values — no real services are contacted during tests.
 */

// Core
process.env.NODE_ENV            = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET          = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';
process.env.ENCRYPTION_KEY      = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
process.env.FRONTEND_URL        = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.PORT                = '4001'; // avoid port conflict with a running dev server

// Supabase — database.js and utils/supabase.js both throw without these
process.env.SUPABASE_URL             = process.env.SUPABASE_URL || 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'stub-service-role-key';
process.env.SUPABASE_SERVICE_KEY     = process.env.SUPABASE_SERVICE_KEY || 'stub-service-key';
process.env.SUPABASE_ANON_KEY        = process.env.SUPABASE_ANON_KEY || 'stub-anon-key';

// Stripe — billing.js calls Stripe(key) at module scope
process.env.STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY || 'sk_test_stub000000000000000000000000000';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_stub';

// Redis / Bull
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// SendGrid / Email
process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'SG.stub';
process.env.EMAIL_FROM       = process.env.EMAIL_FROM || 'noreply@stub.com';

// Anthropic (AI chat routes)
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-stub';

// GitHub OAuth
process.env.GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID || 'stub-client-id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'stub-client-secret';
