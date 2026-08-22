-- Rollback: Remove seeded checklist data

DELETE FROM checklist_items WHERE checklist_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM checklists WHERE id = '00000000-0000-0000-0000-000000000001';
