-- TAP A
BEGIN;
SELECT id, capacity
FROM class_sections
WHERE id = 'RACE-01';
FOR UPDATE;
SELECT pg_sleep(8);
COMMIT;

-- TAP B
BEGIN;
SELECT id, capacity
FROM class_sections
WHERE id = 'RACE-01';
FOR UPDATE;
COMMIT;