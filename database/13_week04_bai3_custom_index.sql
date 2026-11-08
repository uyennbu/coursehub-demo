-- 1. Xóa index nếu đã tồn tại để đo trạng thái TRƯỚC:
DROP INDEX IF EXISTS idx_enrollment_events_section_type_time;
ANALYZE enrollment_events;

-- 2. Đo hiệu năng TRƯỚC khi có index:
-- Quan sát: Seq Scan trên 100,000 dòng, có bước Sort tốn chi phí.
-- Execution time: 8.353 ms
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, class_section_id, event_type, student_id, occurred_at
FROM enrollment_events
WHERE class_section_id = 'WEB-01'
  AND event_type = 'CREATED'
  AND occurred_at >= TIMESTAMP '2025-06-01 00:00:00'
ORDER BY occurred_at DESC
LIMIT 50;

-- 3. Tạo Composite Index theo nguyên tắc: Equality First, Range/Sort Next
CREATE INDEX idx_enrollment_events_section_type_time
ON enrollment_events (class_section_id, event_type, occurred_at DESC);

-- Cập nhật thống kê cho query planner:
ANALYZE enrollment_events;

-- 4. Đo hiệu năng SAU khi có index:
-- Quan sát: Chuyển sang Index Scan, không cần bước Sort, Buffers.
-- Execution time: 0.152 ms
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, class_section_id, event_type, student_id, occurred_at
FROM enrollment_events
WHERE class_section_id = 'WEB-01'
  AND event_type = 'CREATED'
  AND occurred_at >= TIMESTAMP '2025-06-01 00:00:00'
ORDER BY occurred_at DESC
LIMIT 50;

