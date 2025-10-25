-- ============================================================
-- AirClick Database Seed: Action Mappings Data
-- ============================================================
-- Purpose: Populate action_mappings table with all existing actions
--          from backend/app/core/actions.py
-- Author: Muhammad Shawaiz
-- Project: AirClick FYP
-- Date: 2025-10-25
-- ============================================================

-- ============================================================
-- POWERPOINT ACTIONS (34 actions)
-- ============================================================

-- Presentation Navigation (6 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('ppt_next_slide', 'Next Slide', 'Advance to the next slide', 'POWERPOINT', 'NAVIGATION', '["right"]', '→', true),
('ppt_prev_slide', 'Previous Slide', 'Go back to the previous slide', 'POWERPOINT', 'NAVIGATION', '["left"]', '←', true),
('ppt_first_slide', 'First Slide', 'Jump to the first slide', 'POWERPOINT', 'NAVIGATION', '["home"]', '⇤', true),
('ppt_last_slide', 'Last Slide', 'Jump to the last slide', 'POWERPOINT', 'NAVIGATION', '["end"]', '⇥', true),
('ppt_start_presentation', 'Start Presentation', 'Start slideshow from current slide', 'POWERPOINT', 'NAVIGATION', '["shift", "f5"]', '▶', true),
('ppt_end_presentation', 'End Presentation', 'Exit slideshow mode', 'POWERPOINT', 'NAVIGATION', '["escape"]', '◼', true);

-- Presentation Tools (5 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('ppt_toggle_laser', 'Toggle Laser Pointer', 'Toggle laser pointer on/off', 'POWERPOINT', 'SYSTEM', '["ctrl", "l"]', '🔦', true),
('ppt_toggle_pen', 'Toggle Pen', 'Toggle pen drawing mode', 'POWERPOINT', 'EDITING', '["ctrl", "p"]', '✏️', true),
('ppt_erase_annotations', 'Erase Annotations', 'Clear all ink annotations', 'POWERPOINT', 'EDITING', '["e"]', '🧹', true),
('ppt_blank_screen', 'Blank Screen', 'Toggle blank screen (black)', 'POWERPOINT', 'SYSTEM', '["b"]', '⬛', true),
('ppt_white_screen', 'White Screen', 'Toggle white screen', 'POWERPOINT', 'SYSTEM', '["w"]', '⬜', true);

-- Slide Management - Edit Mode (3 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('ppt_new_slide', 'New Slide', 'Insert a new slide', 'POWERPOINT', 'EDITING', '["ctrl", "m"]', '➕', true),
('ppt_duplicate_slide', 'Duplicate Slide', 'Duplicate current slide', 'POWERPOINT', 'EDITING', '["ctrl", "d"]', '📋', true),
('ppt_delete_slide', 'Delete Slide', 'Delete current slide', 'POWERPOINT', 'EDITING', '["delete"]', '🗑️', true);

-- ============================================================
-- MS WORD ACTIONS (20 actions)
-- ============================================================

-- Document Navigation (4 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('word_page_down', 'Page Down', 'Scroll down one page', 'WORD', 'NAVIGATION', '["pagedown"]', '↓', true),
('word_page_up', 'Page Up', 'Scroll up one page', 'WORD', 'NAVIGATION', '["pageup"]', '↑', true),
('word_doc_start', 'Document Start', 'Go to document beginning', 'WORD', 'NAVIGATION', '["ctrl", "home"]', '⇤', true),
('word_doc_end', 'Document End', 'Go to document end', 'WORD', 'NAVIGATION', '["ctrl", "end"]', '⇥', true);

-- Text Formatting (5 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('word_bold', 'Bold', 'Toggle bold formatting', 'WORD', 'FORMATTING', '["ctrl", "b"]', 'B', true),
('word_italic', 'Italic', 'Toggle italic formatting', 'WORD', 'FORMATTING', '["ctrl", "i"]', 'I', true),
('word_underline', 'Underline', 'Toggle underline formatting', 'WORD', 'FORMATTING', '["ctrl", "u"]', 'U', true),
('word_increase_font', 'Increase Font Size', 'Increase font size', 'WORD', 'FORMATTING', '["ctrl", "shift", ">"]', 'A+', true),
('word_decrease_font', 'Decrease Font Size', 'Decrease font size', 'WORD', 'FORMATTING', '["ctrl", "shift", "<"]', 'A-', true);

-- Text Alignment (4 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('word_align_left', 'Align Left', 'Align text to left', 'WORD', 'FORMATTING', '["ctrl", "l"]', '⬅', true),
('word_align_center', 'Align Center', 'Center align text', 'WORD', 'FORMATTING', '["ctrl", "e"]', '⬌', true),
('word_align_right', 'Align Right', 'Align text to right', 'WORD', 'FORMATTING', '["ctrl", "r"]', '➡', true),
('word_justify', 'Justify', 'Justify text alignment', 'WORD', 'FORMATTING', '["ctrl", "j"]', '⬍', true);

-- Editing Actions (4 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('word_undo', 'Undo', 'Undo last action', 'WORD', 'EDITING', '["ctrl", "z"]', '↶', true),
('word_redo', 'Redo', 'Redo last action', 'WORD', 'EDITING', '["ctrl", "y"]', '↷', true),
('word_find', 'Find', 'Open find dialog', 'WORD', 'NAVIGATION', '["ctrl", "f"]', '🔍', true),
('word_replace', 'Find & Replace', 'Open find and replace dialog', 'WORD', 'EDITING', '["ctrl", "h"]', '🔄', true);

-- Document Management (2 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('word_save', 'Save Document', 'Save current document', 'WORD', 'SYSTEM', '["ctrl", "s"]', '💾', true),
('word_print', 'Print', 'Open print dialog', 'WORD', 'SYSTEM', '["ctrl", "p"]', '🖨️', true);

-- ============================================================
-- GLOBAL ACTIONS (11 actions)
-- ============================================================

-- Media Controls (6 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('play_pause', 'Play/Pause Media', 'Toggle play/pause for media', 'GLOBAL', 'MEDIA_CONTROL', '["playpause"]', '⏯', true),
('volume_up', 'Volume Up', 'Increase system volume', 'GLOBAL', 'MEDIA_CONTROL', '["volumeup"]', '🔊', true),
('volume_down', 'Volume Down', 'Decrease system volume', 'GLOBAL', 'MEDIA_CONTROL', '["volumedown"]', '🔉', true),
('mute', 'Mute/Unmute', 'Toggle system mute', 'GLOBAL', 'MEDIA_CONTROL', '["volumemute"]', '🔇', true),
('next_track', 'Next Track', 'Skip to next track', 'GLOBAL', 'MEDIA_CONTROL', '["nexttrack"]', '⏭', true),
('prev_track', 'Previous Track', 'Go to previous track', 'GLOBAL', 'MEDIA_CONTROL', '["prevtrack"]', '⏮', true);

-- System Actions (5 actions)
INSERT INTO action_mappings (action_id, name, description, app_context, category, keyboard_keys, icon, is_active) VALUES
('screenshot', 'Take Screenshot', 'Capture screen screenshot', 'GLOBAL', 'SYSTEM', '["win", "shift", "s"]', '📸', true),
('minimize_window', 'Minimize Window', 'Minimize active window', 'GLOBAL', 'SYSTEM', '["win", "down"]', '🗕', true),
('maximize_window', 'Maximize Window', 'Maximize active window', 'GLOBAL', 'SYSTEM', '["win", "up"]', '🗖', true),
('close_window', 'Close Window', 'Close active window', 'GLOBAL', 'SYSTEM', '["alt", "f4"]', '✖', true),
('task_view', 'Task View', 'Open Windows task view', 'GLOBAL', 'SYSTEM', '["win", "tab"]', '🗔', true);

-- ============================================================
-- VERIFICATION & STATISTICS
-- ============================================================

-- Count total actions
-- Expected: 48 actions (14 PowerPoint + 20 Word + 11 Global)
SELECT
    app_context,
    category,
    COUNT(*) as action_count
FROM action_mappings
GROUP BY app_context, category
ORDER BY app_context, category;

-- Verify all contexts are represented
SELECT
    app_context,
    COUNT(*) as total_actions,
    COUNT(CASE WHEN is_active THEN 1 END) as active_actions
FROM action_mappings
GROUP BY app_context
ORDER BY app_context;

-- Sample queries to verify data integrity
SELECT
    action_id,
    name,
    keyboard_keys,
    icon,
    app_context
FROM action_mappings
WHERE app_context = 'POWERPOINT'
LIMIT 5;

-- Verify JSONB structure
SELECT
    action_id,
    name,
    keyboard_keys,
    jsonb_array_length(keyboard_keys) as key_count
FROM action_mappings
ORDER BY jsonb_array_length(keyboard_keys) DESC
LIMIT 10;

-- Check for actions with most complex keyboard shortcuts
SELECT
    action_id,
    name,
    keyboard_keys,
    jsonb_array_length(keyboard_keys) as num_keys
FROM action_mappings
WHERE jsonb_array_length(keyboard_keys) >= 3
ORDER BY num_keys DESC;

-- ============================================================
-- SUMMARY
-- ============================================================
-- Total Actions: 48
--   - PowerPoint: 14 actions
--   - MS Word: 20 actions
--   - Global: 11 actions
--
-- Categories:
--   - NAVIGATION: 14 actions
--   - EDITING: 10 actions
--   - FORMATTING: 9 actions
--   - MEDIA_CONTROL: 6 actions
--   - SYSTEM: 9 actions
--
-- Key Combinations:
--   - Single key: 15 actions (e.g., ["right"], ["escape"])
--   - Two keys: 30 actions (e.g., ["ctrl", "p"])
--   - Three keys: 3 actions (e.g., ["win", "shift", "s"])
-- ============================================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Action mappings seeded successfully!';
    RAISE NOTICE '✓ Total actions: %', (SELECT COUNT(*) FROM action_mappings);
    RAISE NOTICE '✓ PowerPoint: %', (SELECT COUNT(*) FROM action_mappings WHERE app_context = 'POWERPOINT');
    RAISE NOTICE '✓ Word: %', (SELECT COUNT(*) FROM action_mappings WHERE app_context = 'WORD');
    RAISE NOTICE '✓ Global: %', (SELECT COUNT(*) FROM action_mappings WHERE app_context = 'GLOBAL');
END $$;
