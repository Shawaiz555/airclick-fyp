# AirClick Database Migrations

## Overview
This directory contains SQL migration scripts for the AirClick database schema evolution. All migrations should be executed in order using Supabase SQL Editor.

---

## Migration Files

### `001_create_action_mappings.sql`
**Purpose:** Create the `action_mappings` table for dynamic keyboard shortcut management

**What it creates:**
- ✅ `action_mappings` table with JSONB support for flexible key combinations
- ✅ 7 performance-optimized indexes
- ✅ Automatic `updated_at` trigger
- ✅ Data validation constraints
- ✅ Full documentation comments

**Key Features:**
- **JSONB Column:** `keyboard_keys` stores arrays like `["ctrl", "p"]` or `["win", "shift", "s"]`
- **Flexible:** Supports 1 to unlimited keys per action
- **Validated:** Constraints ensure data integrity
- **Indexed:** Fast queries by context, status, keys
- **Searchable:** Full-text search on name and description

**Schema Highlights:**
```sql
CREATE TABLE action_mappings (
    id SERIAL PRIMARY KEY,
    action_id VARCHAR(100) UNIQUE NOT NULL,     -- "ppt_next_slide"
    name VARCHAR(200) NOT NULL,                  -- "Next Slide"
    description TEXT,
    app_context VARCHAR(50) NOT NULL,            -- "POWERPOINT"
    category VARCHAR(50),                        -- "NAVIGATION"
    keyboard_keys JSONB NOT NULL,                -- ["ctrl", "p"]
    icon VARCHAR(10),                            -- "→"
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

---

### `002_seed_action_mappings.sql`
**Purpose:** Populate the table with all existing actions from `backend/app/core/actions.py`

**What it seeds:**
- ✅ **48 total actions**
  - 14 PowerPoint actions
  - 20 MS Word actions
  - 11 Global actions

**Action Breakdown by Category:**
- **NAVIGATION:** 14 actions (slides, pages, scrolling)
- **EDITING:** 10 actions (copy, paste, undo, annotations)
- **FORMATTING:** 9 actions (bold, italic, alignment)
- **MEDIA_CONTROL:** 6 actions (play, pause, volume)
- **SYSTEM:** 9 actions (screenshot, window management)

**Key Combination Complexity:**
- **Single key:** 15 actions (e.g., `["right"]`, `["escape"]`)
- **Two keys:** 30 actions (e.g., `["ctrl", "p"]`)
- **Three keys:** 3 actions (e.g., `["win", "shift", "s"]`)

**Sample Actions:**
```sql
-- PowerPoint Navigation
('ppt_next_slide', 'Next Slide', 'Advance to the next slide', 'POWERPOINT', 'NAVIGATION', '["right"]', '→', true)

-- Word Formatting
('word_bold', 'Bold', 'Toggle bold formatting', 'WORD', 'FORMATTING', '["ctrl", "b"]', 'B', true)

-- Global Media Control
('play_pause', 'Play/Pause Media', 'Toggle play/pause', 'GLOBAL', 'MEDIA_CONTROL', '["playpause"]', '⏯', true)

-- Complex Shortcut (3 keys)
('screenshot', 'Take Screenshot', 'Capture screen', 'GLOBAL', 'SYSTEM', '["win", "shift", "s"]', '📸', true)
```

---

## How to Run Migrations

### Prerequisites
1. ✅ Active Supabase project
2. ✅ PostgreSQL database with `users` table already created
3. ✅ Admin access to Supabase SQL Editor

### Step-by-Step Instructions

#### **Step 1: Access Supabase SQL Editor**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: **AirClick FYP**
3. Navigate to: **SQL Editor** (left sidebar)
4. Click: **New Query**

#### **Step 2: Run Migration 001 (Create Table)**
1. Open file: `001_create_action_mappings.sql`
2. Copy **entire contents** (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click: **Run** (or press Ctrl+Enter)
5. ✅ Wait for success message: "Success. No rows returned"

**Expected Output:**
```
✓ Table created: action_mappings
✓ 7 indexes created
✓ Trigger created: trigger_update_action_mappings_updated_at
✓ 4 constraints added
```

**Verification Query:**
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'action_mappings'
ORDER BY ordinal_position;
```

#### **Step 3: Run Migration 002 (Seed Data)**
1. Open file: `002_seed_action_mappings.sql`
2. Copy **entire contents**
3. Paste into Supabase SQL Editor
4. Click: **Run**
5. ✅ Wait for success message with counts

**Expected Output:**
```
✓ Action mappings seeded successfully!
✓ Total actions: 48
✓ PowerPoint: 14
✓ Word: 20
✓ Global: 11
```

**Verification Query:**
```sql
SELECT
    app_context,
    COUNT(*) as total
FROM action_mappings
GROUP BY app_context
ORDER BY app_context;
```

**Expected Result:**
| app_context | total |
|-------------|-------|
| GLOBAL      | 11    |
| POWERPOINT  | 14    |
| WORD        | 20    |

#### **Step 4: Verify Installation**
Run these queries to confirm everything is working:

**1. Check table structure:**
```sql
\d action_mappings
```

**2. Count actions:**
```sql
SELECT COUNT(*) FROM action_mappings;
-- Expected: 48
```

**3. Sample data:**
```sql
SELECT action_id, name, keyboard_keys, icon
FROM action_mappings
LIMIT 10;
```

**4. Test JSONB queries:**
```sql
-- Find all actions with "ctrl" key
SELECT action_id, name, keyboard_keys
FROM action_mappings
WHERE keyboard_keys @> '["ctrl"]';

-- Find actions with exactly 3 keys
SELECT action_id, name, keyboard_keys
FROM action_mappings
WHERE jsonb_array_length(keyboard_keys) = 3;
```

**5. Test context filtering:**
```sql
SELECT app_context, COUNT(*) as count
FROM action_mappings
WHERE is_active = true
GROUP BY app_context;
```

---

## Rollback Instructions

If you need to undo the migrations:

### Rollback Migration 002 (Remove Data)
```sql
-- Delete all seeded data
DELETE FROM action_mappings;

-- Verify
SELECT COUNT(*) FROM action_mappings;
-- Expected: 0
```

### Rollback Migration 001 (Drop Table)
```sql
-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_update_action_mappings_updated_at ON action_mappings;
DROP FUNCTION IF EXISTS update_action_mappings_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_action_mappings_action_id;
DROP INDEX IF EXISTS idx_action_mappings_app_context;
DROP INDEX IF EXISTS idx_action_mappings_is_active;
DROP INDEX IF EXISTS idx_action_mappings_context_active;
DROP INDEX IF EXISTS idx_action_mappings_category;
DROP INDEX IF EXISTS idx_action_mappings_keyboard_keys;
DROP INDEX IF EXISTS idx_action_mappings_search;

-- Drop table
DROP TABLE IF EXISTS action_mappings;

-- Verify
SELECT * FROM information_schema.tables WHERE table_name = 'action_mappings';
-- Expected: No rows
```

---

## Testing & Validation

### Unit Tests

**Test 1: Table Exists**
```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'action_mappings'
);
-- Expected: true
```

**Test 2: Correct Row Count**
```sql
SELECT COUNT(*) = 48 as correct_count FROM action_mappings;
-- Expected: true
```

**Test 3: No Null Keys**
```sql
SELECT COUNT(*) FROM action_mappings WHERE keyboard_keys IS NULL;
-- Expected: 0
```

**Test 4: All Actions Active**
```sql
SELECT COUNT(*) FROM action_mappings WHERE is_active = false;
-- Expected: 0 (all should be active initially)
```

**Test 5: Valid App Contexts**
```sql
SELECT COUNT(*) FROM action_mappings
WHERE app_context NOT IN ('GLOBAL', 'POWERPOINT', 'WORD');
-- Expected: 0
```

**Test 6: Valid Categories**
```sql
SELECT COUNT(*) FROM action_mappings
WHERE category NOT IN ('NAVIGATION', 'EDITING', 'FORMATTING', 'MEDIA_CONTROL', 'SYSTEM');
-- Expected: 0
```

**Test 7: Unique Action IDs**
```sql
SELECT action_id, COUNT(*) as count
FROM action_mappings
GROUP BY action_id
HAVING COUNT(*) > 1;
-- Expected: No rows (all unique)
```

**Test 8: JSONB Structure**
```sql
SELECT COUNT(*) FROM action_mappings
WHERE jsonb_typeof(keyboard_keys) != 'array';
-- Expected: 0 (all should be arrays)
```

### Integration Tests

**Test 9: Query by Context**
```sql
SELECT COUNT(*) FROM action_mappings WHERE app_context = 'POWERPOINT';
-- Expected: 14
```

**Test 10: Query by Category**
```sql
SELECT COUNT(*) FROM action_mappings WHERE category = 'NAVIGATION';
-- Expected: 14
```

**Test 11: Search by Key**
```sql
SELECT COUNT(*) FROM action_mappings WHERE keyboard_keys @> '["ctrl"]';
-- Expected: Should return multiple results
```

**Test 12: Full-Text Search**
```sql
SELECT COUNT(*) FROM action_mappings
WHERE to_tsvector('english', name || ' ' || COALESCE(description, ''))
@@ to_tsquery('english', 'slide');
-- Expected: Should find multiple PowerPoint actions
```

---

## Troubleshooting

### Issue 1: "relation 'users' does not exist"
**Cause:** Migration ran before main schema setup
**Solution:** Run `supabase_setup.sql` first to create `users` table

### Issue 2: "duplicate key value violates unique constraint"
**Cause:** Running seed script multiple times
**Solution:** Clear table first: `DELETE FROM action_mappings;`

### Issue 3: "syntax error at or near"
**Cause:** PostgreSQL version incompatibility
**Solution:** Ensure Supabase uses PostgreSQL 14+

### Issue 4: "permission denied for table"
**Cause:** Insufficient database permissions
**Solution:** Use Supabase SQL Editor with admin credentials

### Issue 5: "JSONB column not working"
**Cause:** Incorrect JSONB format
**Solution:** Ensure arrays use double quotes: `["ctrl", "p"]` not `['ctrl', 'p']`

---

## Next Steps

After successfully running migrations:

1. ✅ **Phase 2:** Create SQLAlchemy models (`backend/app/models/action_mapping.py`)
2. ✅ **Phase 3:** Create Pydantic schemas (`backend/app/schemas/action_mapping.py`)
3. ✅ **Phase 4:** Implement API endpoints (`backend/app/api/routes/action_mappings.py`)
4. ✅ **Phase 5:** Build Admin UI (`frontend/app/Admin/action-mappings/page.js`)
5. ✅ **Phase 6:** Update User UI (`frontend/app/components/GestureRecorderReal.js`)

---

## Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    action_mappings                           │
├─────────────────────────────────────────────────────────────┤
│ PK  id                  SERIAL                               │
│ UQ  action_id           VARCHAR(100)    "ppt_next_slide"    │
│     name                VARCHAR(200)    "Next Slide"         │
│     description         TEXT                                 │
│     app_context         VARCHAR(50)     "POWERPOINT"         │
│     category            VARCHAR(50)     "NAVIGATION"         │
│     keyboard_keys       JSONB           ["ctrl", "p"]        │
│     icon                VARCHAR(10)     "→"                  │
│     is_active           BOOLEAN         true                 │
│ FK  created_by          INTEGER    ──→  users(id)            │
│     created_at          TIMESTAMP                            │
│     updated_at          TIMESTAMP                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (one admin creates many actions)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         users                                │
├─────────────────────────────────────────────────────────────┤
│ PK  id                  SERIAL                               │
│     email               VARCHAR(255)                         │
│     role                VARCHAR(20)     "ADMIN"/"USER"       │
│     ...                                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
backend/
├── migrations/
│   ├── README.md                           ← You are here
│   ├── 001_create_action_mappings.sql      ← Table creation
│   └── 002_seed_action_mappings.sql        ← Initial data
├── app/
│   ├── models/
│   │   └── action_mapping.py               ← (Next: Phase 2)
│   ├── schemas/
│   │   └── action_mapping.py               ← (Next: Phase 3)
│   └── api/
│       └── routes/
│           └── action_mappings.py          ← (Next: Phase 4)
└── supabase_setup.sql                      ← Original schema
```

---

## Support & Documentation

- **Project:** AirClick FYP
- **Author:** Muhammad Shawaiz
- **Database:** Supabase (PostgreSQL 14+)
- **Documentation:** This README + inline SQL comments

For questions or issues, refer to the comprehensive comments in each SQL file.

---

## Migration Status

| Migration | Status | Rows Affected | Date |
|-----------|--------|---------------|------|
| 001_create_action_mappings.sql | ⏳ Pending | N/A | - |
| 002_seed_action_mappings.sql   | ⏳ Pending | 48 expected | - |

**Note:** Update this table after running each migration!

---

✅ **Phase 1 Complete!** Proceed to Phase 2: Backend Models
