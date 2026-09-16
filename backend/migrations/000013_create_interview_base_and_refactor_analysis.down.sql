-- Migration 000013 Rollback

DROP TABLE IF EXISTS interview_base_questions;
ALTER TABLE interview_questions DROP COLUMN IF EXISTS rq_category;
ALTER TABLE interview_questions DROP COLUMN IF EXISTS is_user_edited;
ALTER TABLE analysis_runs DROP COLUMN IF EXISTS core_questions_status;
ALTER TABLE analysis_runs DROP COLUMN IF EXISTS core_questions;
