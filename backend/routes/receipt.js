/**
 * backend/routes/receipt.js
 *
 * Public (no auth) endpoints for the shareable migration receipt.
 *
 * GET /api/receipt/:migrationId
 *   Returns a safe, stripped-down snapshot of a completed migration
 *   suitable for public display.  Sensitive fields (credentials,
 *   user_id, stripe IDs, analysis internals) are never included.
 *
 * Only migrations with status === 'complete' are served.
 * Returns 404 for anything else so URLs cannot be used to probe
 * for failed / in-progress migrations.
 */
const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../utils/supabase');

// Friendly display names for known platforms
const PLATFORM_LABELS = {
  vercel:   { name: 'Vercel',   icon: '▲', color: '#000' },
  railway:  { name: 'Railway',  icon: '🚂', color: '#7C3AED' },
  supabase: { name: 'Supabase', icon: '⚡', color: '#3ECF8E' },
  github:   { name: 'GitHub',   icon: '🐙', color: '#1A1814' },
  replit:   { name: 'Replit',   icon: '🌀', color: '#F26207' },
};

const FRAMEWORK_ICONS = {
  next:       '▲', nextjs: '▲',
  react:      '⚛️',
  vue:        '💚',
  nuxt:       '💚',
  svelte:     '🧡',
  angular:    '🔴',
  express:    '🟩',
  fastapi:    '🐍',
  django:     '🐍',
  flask:      '🐍',
  rails:      '💎',
  laravel:    '🔴',
  remix:      '🎵',
  astro:      '🚀',
  gatsby:     '💜',
};

router.get('/:migrationId', async (req, res) => {
  try {
    const { migrationId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('migrations')
      .select(
        'id, reponame, repourl, source_platform, platforms, status, '
        + 'created_at, completed_at, deployed_urls, analysis_result, tier'
      )
      .eq('id', migrationId)
      .eq('status', 'complete')   // only expose completed migrations
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    const analysis = data.analysis_result || {};
    const platforms = (data.platforms || []).map(p => PLATFORM_LABELS[p] || { name: p, icon: '📦', color: '#5C574E' });
    const rawFramework = (analysis.framework || '').toLowerCase();
    const frameworkIcon = FRAMEWORK_ICONS[rawFramework] || '🛠️';

    // Build a clean receipt object
    const receipt = {
      id:           data.id,
      appName:      data.reponame || data.repourl?.split('/').pop() || 'App',
      repoUrl:      data.repourl,
      sourcePlatform: PLATFORM_LABELS[data.source_platform] || { name: data.source_platform, icon: '📦' },
      platforms,
      status:       data.status,
      migratedAt:   data.completed_at || data.created_at,
      liveUrl:      data.deployed_urls?.frontend || null,
      techStack: {
        framework:  analysis.framework  || null,
        language:   analysis.language   || null,
        database:   analysis.database   || null,
        frameworkIcon,
      },
      tier: data.tier || 'standard',
    };

    return res.json({ receipt });
  } catch (err) {
    console.error('[receipt]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
