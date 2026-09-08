-- ============================================================
-- Truncate All Data & Re-seed Default Observation Checklist & AI Settings
-- Preserves: api_keys, ai_models, flow_configs (system configurations)
-- ============================================================

BEGIN;

TRUNCATE TABLE 
    interview_questions,
    teacher_analyses,
    themes,
    categories,
    patterns,
    analysis_runs,
    report_items,
    reports,
    event_mappings,
    raw_events,
    codebook_entries,
    video_chunks,
    pipeline_jobs,
    videos,
    checklist_items,
    checklists,
    users
RESTART IDENTITY CASCADE;

-- Re-insert default seed checklist (Sections A–E)
INSERT INTO checklists (id, name, version)
VALUES ('00000000-0000-0000-0000-000000000001', 'Observation Checklist', 'v1.0')
ON CONFLICT (id) DO NOTHING;

-- Section A. Establishing Online Rules and Routines
INSERT INTO checklist_items (checklist_id, section, text, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'A', 'Teacher explains classroom rules', 1),
('00000000-0000-0000-0000-000000000001', 'A', 'Teacher reminds students of classroom expectations', 2),
('00000000-0000-0000-0000-000000000001', 'A', 'Teacher establishes lesson routines', 3),
('00000000-0000-0000-0000-000000000001', 'A', 'Teacher provides clear task instructions', 4),
('00000000-0000-0000-0000-000000000001', 'A', 'Teacher manages transitions between activities', 5);

-- Section B. Managing Turn-taking and Speaking Participation
INSERT INTO checklist_items (checklist_id, section, text, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'B', 'Teacher nominates students to speak', 1),
('00000000-0000-0000-0000-000000000001', 'B', 'Teacher encourages volunteers', 2),
('00000000-0000-0000-0000-000000000001', 'B', 'Teacher provides wait time', 3),
('00000000-0000-0000-0000-000000000001', 'B', 'Teacher encourages quieter learners', 4),
('00000000-0000-0000-0000-000000000001', 'B', 'Teacher balances speaking opportunities', 5),
('00000000-0000-0000-0000-000000000001', 'B', 'Teacher organises pair/group speaking tasks', 6);

-- Section C. Sustaining Learner Attention and Engagement
INSERT INTO checklist_items (checklist_id, section, text, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'C', 'Teacher monitors learner attention', 1),
('00000000-0000-0000-0000-000000000001', 'C', 'Teacher checks understanding', 2),
('00000000-0000-0000-0000-000000000001', 'C', 'Teacher asks follow-up questions', 3),
('00000000-0000-0000-0000-000000000001', 'C', 'Teacher redirects distracted learners', 4),
('00000000-0000-0000-0000-000000000001', 'C', 'Teacher maintains lesson pace', 5),
('00000000-0000-0000-0000-000000000001', 'C', 'Teacher motivates learners to participate', 6);

-- Section D. Providing Scaffolding and Positive Reinforcement
INSERT INTO checklist_items (checklist_id, section, text, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'D', 'Teacher models target language', 1),
('00000000-0000-0000-0000-000000000001', 'D', 'Teacher provides sentence starters', 2),
('00000000-0000-0000-0000-000000000001', 'D', 'Teacher uses prompts', 3),
('00000000-0000-0000-0000-000000000001', 'D', 'Teacher gives praise and encouragement', 4),
('00000000-0000-0000-0000-000000000001', 'D', 'Teacher provides corrective feedback', 5),
('00000000-0000-0000-0000-000000000001', 'D', 'Teacher adjusts support based on learners'' responses', 6);

-- Section E. Using Digital Tools to Support Learning and Interaction
INSERT INTO checklist_items (checklist_id, section, text, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'E', 'Teacher uses the chat box', 1),
('00000000-0000-0000-0000-000000000001', 'E', 'Teacher uses reaction icons', 2),
('00000000-0000-0000-0000-000000000001', 'E', 'Teacher uses breakout rooms', 3),
('00000000-0000-0000-0000-000000000001', 'E', 'Teacher shares screen', 4),
('00000000-0000-0000-0000-000000000001', 'E', 'Teacher uses a digital whiteboard', 5),
('00000000-0000-0000-0000-000000000001', 'E', 'Teacher uses polls or annotation tools', 6);

-- Re-ensure AI Model Catalog & Default Flow Configurations
INSERT INTO ai_models (id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
VALUES
    ('gemini-3.7-flash',  'gemini',     'Google: Gemini 3.7 Flash',                 1048576, TRUE,  TRUE,  TRUE, 1),
    ('gemini-2.5-flash',  'gemini',     'Google: Gemini 2.5 Flash',                 1048576, TRUE,  FALSE, TRUE, 2),
    ('gemini-2.5-pro',    'gemini',     'Google: Gemini 2.5 Pro',                   2097152, TRUE,  TRUE,  TRUE, 3),
    ('claude-3.7-sonnet', 'openrouter', 'Anthropic: Claude 3.7 Sonnet (OpenRouter)', 200000,  FALSE, TRUE,  TRUE, 4),
    ('gpt-4o',            'openrouter', 'OpenAI: GPT-4o (OpenRouter)',               128000,  FALSE, TRUE,  TRUE, 5),
    ('deepseek-r1',       'openrouter', 'DeepSeek: R1 (OpenRouter)',                  64000,   FALSE, TRUE,  TRUE, 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO flow_configs (flow_key, model_id, temperature, fallback_model_id)
VALUES
    ('video_extraction',   'gemini-3.7-flash', 0.20, 'gemini-2.5-flash'),
    ('checklist_mapping',  'gemini-3.7-flash', 0.10, 'gemini-2.5-flash'),
    ('thematic_analysis',  'gemini-3.7-flash', 0.40, 'gemini-3.7-flash'),
    ('interview_generator','gemini-3.7-flash', 0.50, 'gemini-3.7-flash'),
    ('codebook_generation','gemini-3.7-flash', 0.30, 'gemini-2.5-flash')
ON CONFLICT (flow_key) DO NOTHING;

COMMIT;
