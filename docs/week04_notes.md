# CourseHub - Buoi 4
- Migration 001: enrollment_events.
- Demo class: RACE-01, capacity = 1.
- POST /enrollments: lock class_sections bang FOR UPDATE.
- Concurrency test: 1 request 201, 1 request 409.
- Performance data: 100000 rows, dataset=performance.
- Index: idx_enrollment_events_dataset_student_time.
- Scan time truoc: 5.555 ms  | sau: 0.159 ms
- Migration 002: thêm cột note vào enrollment_events, rollback. Khi rollback trong bảng enrollment_events chỉ có cột note bị xóa, các dữ liệu khác ban đầu không bị ảnh hưởng. Version 002 bị xóa khỏi schema_migrations