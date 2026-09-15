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
INSERT INTO ai_models (id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'gemini', 'gemini-3.7-flash',       'Google: Gemini 3.7 Flash',                 1048576, TRUE,  TRUE,  TRUE, 1),
    ('10000000-0000-0000-0000-000000000005', 'gemini', 'gemini-2.5-flash',       'Google: Gemini 2.5 Flash',                 1048576, TRUE,  FALSE, TRUE, 2),
    ('10000000-0000-0000-0000-000000000006', 'gemini', 'gemini-2.5-pro',         'Google: Gemini 2.5 Pro',                   2097152, TRUE,  TRUE,  TRUE, 3),
    ('20000000-0000-0000-0000-000000000001', 'vertex_ai', 'gemini-3.7-flash',   'Vertex AI: Gemini 3.7 Flash',              1048576, TRUE,  TRUE,  TRUE, 10),
    ('20000000-0000-0000-0000-000000000002', 'vertex_ai', 'gemini-2.5-pro',     'Vertex AI: Gemini 2.5 Pro',                2097152, TRUE,  TRUE,  TRUE, 11),
    ('20000000-0000-0000-0000-000000000003', 'vertex_ai', 'gemini-2.5-flash',   'Vertex AI: Gemini 2.5 Flash',              1048576, TRUE,  FALSE, TRUE, 12),
    ('30000000-0000-0000-0000-000000000001', 'openrouter', 'anthropic/claude-3.7-sonnet', 'Anthropic: Claude 3.7 Sonnet (OpenRouter)', 200000, FALSE, TRUE, TRUE, 20),
    ('30000000-0000-0000-0000-000000000002', 'openrouter', 'openai/gpt-4o',              'OpenAI: GPT-4o (OpenRouter)',               128000, FALSE, TRUE, TRUE, 21),
    ('30000000-0000-0000-0000-000000000003', 'openrouter', 'deepseek/deepseek-r1',        'DeepSeek: R1 (OpenRouter)',                  64000,  FALSE, TRUE, TRUE, 22)
ON CONFLICT (provider, model_id) DO NOTHING;

INSERT INTO flow_configs (flow_key, model_catalog_id, temperature, fallback_model_catalog_id)
VALUES
    ('video_extraction',   '10000000-0000-0000-0000-000000000001', 0.20, '10000000-0000-0000-0000-000000000005'),
    ('checklist_mapping',  '10000000-0000-0000-0000-000000000001', 0.10, '10000000-0000-0000-0000-000000000005'),
    ('thematic_analysis',  '10000000-0000-0000-0000-000000000001', 0.40, '10000000-0000-0000-0000-000000000001'),
    ('interview_generator','10000000-0000-0000-0000-000000000001', 0.50, '10000000-0000-0000-0000-000000000001'),
    ('codebook_generation','10000000-0000-0000-0000-000000000001', 0.30, '10000000-0000-0000-0000-000000000005')
ON CONFLICT (flow_key) DO NOTHING;

COMMIT;
