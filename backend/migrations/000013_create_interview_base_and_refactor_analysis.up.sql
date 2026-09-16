-- ============================================================
-- Migration 000013: Create Interview Base Questions & Refactor Analysis
-- ============================================================

-- 1. Base Semi-structured Interview Questions
CREATE TABLE IF NOT EXISTS interview_base_questions (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    section        VARCHAR(50)  NOT NULL,
    section_title  VARCHAR(200) NOT NULL,
    question_index INTEGER      NOT NULL,
    question_text  TEXT         NOT NULL,
    rq_category    VARCHAR(50)  NOT NULL, -- 'BACKGROUND', 'RQ1', 'RQ2', 'RQ3', 'CLOSING'
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order     INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_base_rq ON interview_base_questions(rq_category);
CREATE INDEX IF NOT EXISTS idx_interview_base_active ON interview_base_questions(is_active);

-- 2. Add RQ category & edit flag to dynamic/core interview_questions
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS rq_category VARCHAR(50);
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_user_edited BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Add Core Questions status and JSON storage to analysis_runs
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS core_questions_status VARCHAR(50) NOT NULL DEFAULT 'draft';
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS core_questions JSONB DEFAULT '[]'::jsonb;

-- 4. Seed Default 22 Semi-structured Interview Questions
INSERT INTO interview_base_questions (section, section_title, question_index, question_text, rq_category, sort_order)
VALUES
    -- Section A. Background Information
    ('Section A', 'Background Information', 1, 'Could you briefly introduce yourself and describe your current teaching position?', 'BACKGROUND', 1),
    ('Section A', 'Background Information', 2, 'How many years have you been teaching English?', 'BACKGROUND', 2),
    ('Section A', 'Background Information', 3, 'How long have you been teaching online English classes?', 'BACKGROUND', 3),
    ('Section A', 'Background Information', 4, 'Which grades or age groups do you currently teach?', 'BACKGROUND', 4),
    ('Section A', 'Background Information', 5, 'Which online platforms do you usually use for your English speaking lessons?', 'BACKGROUND', 5),

    -- Section B. Classroom Management Strategies (RQ1)
    ('Section B', 'Classroom Management Strategies (RQ1)', 6, 'Could you describe how you usually manage an online English speaking lesson from the beginning to the end?', 'RQ1', 6),
    ('Section B', 'Classroom Management Strategies (RQ1)', 7, 'How do you establish classroom rules and routines in your online speaking classes?', 'RQ1', 7),
    ('Section B', 'Classroom Management Strategies (RQ1)', 8, 'How do you manage turn-taking during speaking activities?', 'RQ1', 8),
    ('Section B', 'Classroom Management Strategies (RQ1)', 9, 'What strategies do you use to maintain learners'' attention and engagement throughout the lesson?', 'RQ1', 9),
    ('Section B', 'Classroom Management Strategies (RQ1)', 10, 'How do you support learners when they have difficulty speaking English?', 'RQ1', 10),
    ('Section B', 'Classroom Management Strategies (RQ1)', 11, 'How do you use digital tools such as the chat box, breakout rooms, reaction icons, screen sharing, or digital whiteboards during speaking lessons?', 'RQ1', 11),

    -- Section C. Teachers'' Perceptions (RQ2)
    ('Section C', 'Teachers'' Perceptions (RQ2)', 12, 'In your opinion, what role does classroom management play in promoting speaking participation among primary learners?', 'RQ2', 12),
    ('Section C', 'Teachers'' Perceptions (RQ2)', 13, 'Which classroom management strategies do you consider most effective? Why?', 'RQ2', 13),
    ('Section C', 'Teachers'' Perceptions (RQ2)', 14, 'How do these strategies influence learners'' confidence and willingness to communicate?', 'RQ2', 14),
    ('Section C', 'Teachers'' Perceptions (RQ2)', 15, 'Do different learners respond differently to the same classroom management strategies? Could you explain?', 'RQ2', 15),
    ('Section C', 'Teachers'' Perceptions (RQ2)', 16, 'Have your views about classroom management changed since you began teaching online? If yes, how?', 'RQ2', 16),

    -- Section D. Challenges (RQ3)
    ('Section D', 'Challenges (RQ3)', 17, 'What challenges do you most frequently encounter when managing online English speaking classes?', 'RQ3', 17),
    ('Section D', 'Challenges (RQ3)', 18, 'Which challenges have the greatest impact on learners'' speaking participation?', 'RQ3', 18),
    ('Section D', 'Challenges (RQ3)', 19, 'How do you usually deal with learners who are reluctant to participate in speaking activities?', 'RQ3', 19),
    ('Section D', 'Challenges (RQ3)', 20, 'How do you deal with technical problems that occur during online speaking lessons?', 'RQ3', 20),
    ('Section D', 'Challenges (RQ3)', 21, 'Are there any classroom management challenges that remain difficult to address? Please explain.', 'RQ3', 21),

    -- Closing Question
    ('Closing', 'Closing Question', 22, 'Is there anything else you would like to share about your experiences of managing online English speaking classes for primary EFL learners?', 'CLOSING', 22)
ON CONFLICT DO NOTHING;
