-- ============================================================
-- Seed: Default Observation Checklist (Sections A–E)
-- ============================================================

INSERT INTO checklists (id, name, version)
VALUES ('00000000-0000-0000-0000-000000000001', 'Observation Checklist', 'v1.0');

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
