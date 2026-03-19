# Integration Guide

## Adding Multi-Source to Existing Code

### 1. Import Services

```javascript
// In agent/analyzer.js
const ReplitService = require('../services/replit');
const EmergentService = require('../services/emergent');
```

### 2. Update Migration Record

```javascript
// Add source_platform when creating migration
const { data } = await supabase
  .from('migrations')
  .insert([{
    user_id: userId,
    repourl: sourceUrl,
    source_platform: selectedSource, // 'github'|'replit'|'emergent'
    status: 'analyzing',
  }]);
```

### 3. Database Migration

```sql
-- Run once in Supabase SQL editor
ALTER TABLE migrations
  ADD COLUMN IF NOT EXISTS source_platform TEXT DEFAULT 'github';
```

### 4. Test Each Source

```bash
# GitHub
curl -X POST /api/migrations/validate-source \
  -d '{"platform":"github","url":"https://github.com/vercel/next.js"}'

# Replit
curl -X POST /api/migrations/validate-source \
  -d '{"platform":"replit","url":"https://replit.com/@user/project"}'

# Emergent
curl -X POST /api/migrations/validate-source \
  -d '{"platform":"emergent","url":"https://emergent.dev/project/abc123"}'
```
