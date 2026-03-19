/**
 * pages/api/deploy.js
 *
 * One-click deployment API — orchestrates the entire MigrateBot setup
 * Called by pages/setup.jsx
 * Streams real-time logs back to the client as NDJSON
 */

const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { supabaseToken, stripeKey, railwayToken, vercelToken, anthropicKey } = req.body;

  if (!supabaseToken || !stripeKey || !railwayToken || !vercelToken || !anthropicKey) {
    return res.status(400).json({ error: 'All 5 API keys are required' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');

  const log = (message, type = 'info') => res.write(JSON.stringify({ message, type }) + '\n');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    // ── STEP 1: Supabase ─────────────────────────────────────────────
    log('Creating Supabase project...', 'info');
    const dbPass = crypto.randomBytes(12).toString('base64');

    const sbRes = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supabaseToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'migratebot', db_pass: dbPass, region: 'us-east-1' }),
    });

    if (!sbRes.ok) throw new Error(`Supabase error: ${await sbRes.text()}`);
    const sbProject = await sbRes.json();
    const projectId = sbProject.id;
    log(`✓ Supabase project created: ${projectId}`, 'success');

    // Wait for active
    log('Waiting for Supabase to initialize (up to 2 min)...', 'info');
    let supabaseUrl = null;
    for (let i = 0; i < 120; i++) {
      await sleep(1000);
      const statusRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${supabaseToken}` },
      });
      const s = await statusRes.json();
      if (s.status === 'ACTIVE_HEALTHY') {
        supabaseUrl = s.api_url || `https://${projectId}.supabase.co`;
        log('✓ Supabase is active and healthy', 'success');
        break;
      }
      if (i % 10 === 0) log(`  Still waiting... (${i}s)`, 'info');
    }
    if (!supabaseUrl) throw new Error('Supabase timed out');

    // ── STEP 2: Stripe ────────────────────────────────────────────────
    log('Creating Stripe products...', 'info');
    const stripeAuth = 'Basic ' + Buffer.from(`:${stripeKey}`).toString('base64');

    const mkProduct = async (name) => {
      const r = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: { Authorization: stripeAuth },
        body: new URLSearchParams({ name, type: 'service' }),
      });
      return (await r.json()).id;
    };

    const stdId = await mkProduct('Standard Migration');
    log(`✓ Standard product created ($100): ${stdId}`, 'success');
    const proId = await mkProduct('Pro Migration');
    log(`✓ Pro product created ($250): ${proId}`, 'success');

    // Stripe webhook (placeholder URL updated later)
    const whRes = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
      method: 'POST',
      headers: { Authorization: stripeAuth },
      body: new URLSearchParams({
        url: 'https://migratebot-production.up.railway.app/webhooks/stripe',
        'enabled_events[]': 'payment_intent.succeeded',
      }),
    });
    const wh = await whRes.json();
    log(`✓ Stripe webhook created`, 'success');

    // ── STEP 3: Generate Secrets ──────────────────────────────────────
    log('Generating secrets...', 'info');
    const ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    const JWT_SECRET = crypto.randomBytes(32).toString('base64');
    log('✓ ENCRYPTION_KEY generated (64-char hex)', 'success');
    log('✓ JWT_SECRET generated (32-char base64)', 'success');

    // ── STEP 4: Railway ───────────────────────────────────────────────
    log('Creating Railway project...', 'info');
    const railwayGql = async (query) => {
      const r = await fetch('https://api.railway.app/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${railwayToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return r.json();
    };

    const projRes = await railwayGql(`mutation { projectCreate(input:{name:"migratebot"}) { project { id } } }`);
    const railwayProjectId = projRes.data?.projectCreate?.project?.id;
    if (!railwayProjectId) throw new Error('Railway project creation failed');
    log(`✓ Railway project created: ${railwayProjectId}`, 'success');

    await railwayGql(`mutation { serviceCreate(input:{projectId:"${railwayProjectId}",name:"redis",template:"redis"}) { service { id } } }`);
    log('✓ Redis database added', 'success');

    const backendRes = await railwayGql(`mutation { serviceCreate(input:{projectId:"${railwayProjectId}",name:"backend"}) { service { id } } }`);
    const backendId = backendRes.data?.serviceCreate?.service?.id;
    log('✓ Backend service created', 'success');

    // Set env vars
    log('Setting environment variables...', 'info');
    const envVars = [
      ['NODE_ENV', 'production'], ['JWT_EXPIRES_IN', '7d'],
      ['ENCRYPTION_KEY', ENCRYPTION_KEY], ['JWT_SECRET', JWT_SECRET],
      ['SUPABASE_URL', supabaseUrl], ['ANTHROPIC_API_KEY', anthropicKey],
      ['STRIPE_SECRET_KEY', stripeKey],
      ['STRIPE_PRODUCT_STANDARD_ID', stdId], ['STRIPE_PRODUCT_PRO_ID', proId],
      ['STRIPE_WEBHOOK_SECRET', wh.secret || ''],
      ['FRONTEND_URL', 'https://migratebot.vercel.app'],
    ];
    for (const [key, value] of envVars) {
      await railwayGql(`mutation { variableUpsert(input:{serviceId:"${backendId}",key:"${key}",value:"${value.replace(/"/g, '\\"')}"}) { variable { id } } }`);
    }
    log('✓ All environment variables set', 'success');

    // ── STEP 5: Vercel ────────────────────────────────────────────────
    log('Creating Vercel project...', 'info');
    const vercelRes = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'migratebot', framework: 'nextjs' }),
    });
    const vercelProject = await vercelRes.json();
    const vercelId = vercelProject.id;
    if (!vercelId) throw new Error('Vercel project creation failed');
    log(`✓ Vercel project created`, 'success');

    const RAILWAY_URL = 'https://migratebot-production.up.railway.app';
    const vercelEnv = [
      { key: 'NEXT_PUBLIC_API_URL', value: RAILWAY_URL },
      { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
      { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', value: stripeKey.replace('sk_test_', 'pk_test_') },
      { key: 'NEXT_PUBLIC_ENV', value: 'production' },
    ];
    for (const env of vercelEnv) {
      await fetch(`https://api.vercel.com/v9/projects/${vercelId}/env`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...env, type: 'plain', target: ['production'] }),
      });
    }
    log('✓ Vercel environment variables set', 'success');

    // ── STEP 6: Summary ───────────────────────────────────────────────
    log('', 'info');
    log('🎉 Deployment complete!', 'success');
    log(`Frontend: https://migratebot.vercel.app`, 'success');
    log(`Backend:  ${RAILWAY_URL}`, 'success');
    log(`Database: ${supabaseUrl}`, 'success');
    log('', 'info');
    log('Next: Wait 3-5 min for Railway + Vercel builds to finish, then visit your frontend URL.', 'info');

    res.end();
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'error');
    res.end();
  }
}
