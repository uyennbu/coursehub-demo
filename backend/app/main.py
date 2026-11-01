from __future__ import annotations
import logging
from fastapi import FastAPI, HTTPException, Query, Response, status, Body
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from .database import engine
from .schemas import EnrollmentCreate, UpdateCapacityRequest

logger = logging.getLogger(__name__)

app = FastAPI(
    title="CourseHub API",
    version="0.4.0",
    description="API thuc hanh Buoi 4 - transaction, locking va hieu nang",
)

@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "CourseHub API dang hoat dong"}

@app.get("/health")
def health_check() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Khong ket noi duoc co so du lieu")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Khong ket noi duoc co so du lieu",
        ) from exc
    return {"status": "ok", "database": "connected"}

@app.get("/courses")
def list_courses(
    q: str | None = Query(default=None, min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
) -> list[dict[str, object]]:
    sql = """
        SELECT code, name, credits
        FROM courses
    """
    parameters: dict[str, object] = {
        "skip": skip,    
        "limit": limit  
    }
    if q is not None:
        keyword = q.strip().lower()
        if not keyword:
            raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu khoa tim kiem khong duoc rong",
            )
        sql += """
        WHERE LOWER(code) LIKE :keyword
        OR LOWER(name) LIKE :keyword
        """
        parameters["keyword"] = f"%{keyword}%"
    sql += " ORDER BY code ASC OFFSET :skip LIMIT :limit"

    with engine.connect() as connection:
        rows = connection.execute(text(sql), parameters).mappings().all()
    return [dict(row) for row in rows]

@app.get("/courses/{course_code}")
def get_course(course_code: str, skip=0, limit=10) -> dict[str, object]:
    sql = """
    SELECT code, name, credits
    FROM courses
    WHERE code = :course_code
    """

    with engine.connect() as connection:
        row = connection.execute(
            text(sql),
            {"course_code": course_code.upper()},
        ).mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Khong tim thay hoc phan",
        )
    return dict(row)

@app.get("/sections")
def list_sections(
    available_only: bool = False,
) -> list[dict[str, object]]:
    sql = """
        SELECT class_id, course_code, capacity, enrolled, remaining
        FROM v_section_summary
    """
    if available_only:
        sql += " WHERE remaining > 0"
    sql += " ORDER BY class_id"
    with engine.connect() as connection:
        rows = connection.execute(text(sql)).mappings().all()
    return [dict(row) for row in rows]

@app.get("/students/{student_id}/enrollments")
def list_student_enrollments(student_id: str) -> list[dict[str, object]]:
    student_sql = "SELECT id FROM students WHERE id = :student_id"
    enrollment_sql = """
        SELECT e.student_id,
        s.name AS student_name,
        cs.id AS class_section_id,
        c.code AS course_code,
        c.name AS course_name,
        e.registered_at
        FROM enrollments AS e
        JOIN students AS s ON s.id = e.student_id
        JOIN class_sections AS cs ON cs.id = e.class_section_id
        JOIN courses AS c ON c.code = cs.course_code
        WHERE e.student_id = :student_id
        ORDER BY cs.id
    """ 

    with engine.connect() as connection:
        student = connection.execute(
            text(student_sql),
            {"student_id": student_id},
        ).first()

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay sinh vien",
            )
        rows = connection.execute(
            text(enrollment_sql),
            {"student_id": student_id},
        ).mappings().all()

    return [dict(row) for row in rows]

@app.post(
    "/enrollments",
    status_code=status.HTTP_201_CREATED,
)
def create_enrollment(payload: EnrollmentCreate) -> dict[str, str]:
    student_sql = "SELECT id FROM students WHERE id = :student_id"
    lock_section_sql = """
        SELECT id, capacity
        FROM class_sections
        WHERE id = :class_section_id
        FOR UPDATE
    """

    duplicate_sql = """
        SELECT 1
        FROM enrollments
        WHERE student_id = :student_id
            AND class_section_id = :class_section_id
    """

    count_sql = """
        SELECT COUNT(*)
        FROM enrollments
        WHERE class_section_id = :class_section_id
    """

    insert_sql = """
        INSERT INTO enrollments (student_id, class_section_id)
        VALUES (:student_id, :class_section_id)
    """

    event_sql = """
        INSERT INTO enrollment_events
            (student_id, class_section_id, event_type, source, dataset)
        VALUES
            (:student_id, :class_section_id, 'CREATED', 'api', 'demo')
    """

    parameters = {
        "student_id": payload.student_id,
        "class_section_id": payload.class_section_id,
    }

    try:
        with engine.begin() as connection:
            # 1. Khóa lớp học phần trước để tránh Deadlock giữa các thread race condition
            section = connection.execute(
                text(lock_section_sql),
                {"class_section_id": payload.class_section_id},
            ).mappings().first()

            if section is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Khong tim thay lop hoc phan",
                )

            # 2. Kiểm tra sinh viên có tồn tại không
            student = connection.execute(
                text(student_sql),
                {"student_id": payload.student_id},
            ).first()

            if student is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Khong tim thay sinh vien",
                )

            # 3. Kiểm tra trùng lặp đăng ký
            duplicated = connection.execute(
                text(duplicate_sql), parameters
            ).first()

            if duplicated is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Sinh vien da dang ky lop nay",
                )

            # 4. Kiểm tra sĩ số lớp
            enrolled = connection.execute(
                text(count_sql),
                {"class_section_id": payload.class_section_id},
            ).scalar_one()

            if int(enrolled) >= int(section["capacity"]):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Lop hoc phan da het cho",
                )

            # 5. Thêm dữ liệu đăng ký & event
            connection.execute(text(insert_sql), parameters)
            connection.execute(text(event_sql), parameters)

    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Dang ky xung dot voi du lieu hien tai",
        ) from exc

    return {
        "message": "Dang ky thanh cong",
        "student_id": payload.student_id,
        "class_section_id": payload.class_section_id,
    }

@app.delete(
    "/enrollments/{student_id}/{class_section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_enrollment(student_id: str, class_section_id: str) -> Response:
    lock_section_sql = """
        SELECT id
        FROM class_sections
        WHERE id = :class_section_id
        FOR UPDATE
    """

    delete_sql = """
        DELETE FROM enrollments
        WHERE student_id = :student_id
            AND class_section_id = :class_section_id
        RETURNING student_id
    """

    event_sql = """
        INSERT INTO enrollment_events
            (student_id, class_section_id, event_type, source, dataset)
        VALUES
            (:student_id, :class_section_id, 'CANCELLED', 'api', 'demo')
    """

    parameters = {
        "student_id": student_id,
        "class_section_id": class_section_id,
    }

    with engine.begin() as connection:
        section = connection.execute(
            text(lock_section_sql),
            {"class_section_id": class_section_id},
        ).first()
        if section is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay lop hoc phan",
            )

        deleted = connection.execute(
            text(delete_sql), parameters
        ).first()
        if deleted is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay dang ky can huy",
            )

        connection.execute(text(event_sql), parameters)

    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Home work week 4


# Home work
@app.get("/lecturers")
def list_lecturers() -> list[dict[str, object]]:
    sql = """
        SELECT id, name
        FROM lecturers
        ORDER BY id;
    """
    with engine.connect() as connection:
        rows = connection.execute(text(sql)).mappings().all()

    return [dict(row) for row in rows]

@app.get("/sections/{section_id}")
def get_section(section_id: str) -> dict[str, object]:
    sql = """
        SELECT 
            cs.id AS class_id, 
            cs.course_code AS course_code, 
            c.name AS course_name,
            semesters.name AS semester, 
            lecturers.id AS lecturer_id, 
            cs.capacity AS capacity, 
            vs.enrolled AS enrolled, 
            vs.remaining AS remaining
        FROM class_sections AS cs
        JOIN courses AS c ON c.code = cs.course_code
        JOIN v_section_summary AS vs ON cs.id = vs.class_id
        JOIN semesters ON semesters.code = cs.semester_code
        JOIN lecturers ON lecturers.id = cs.lecturer_id
        WHERE cs.id = :section_id;
    """
    with engine.connect() as connection:
        row = connection.execute(
            text(sql),
            {"section_id": section_id.upper()},
        ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "khong tim thay section"
        )

    return dict(row)

@app.patch("/sections/{section_id}/capacity")
def update_capacity(
    section_id: str,
    body: UpdateCapacityRequest
):
    class_sql = """
        SELECT class_id, enrolled, remaining FROM v_section_summary
        WHERE class_id = :section_id
    """
    update_sql = """
        UPDATE class_sections
        SET capacity = :capacity
        WHERE id = :section_id
    """
    with  engine.begin() as connection:
        class_section = connection.execute(
            text(class_sql),
            {'section_id': section_id},
        ).mappings().first()

        if class_section is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail = "Khong tim thay lop hoc",
            )

        enrolled = class_section["enrolled"]
        if body.capacity < enrolled:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail = "So cho nho hon so cho ban dau"
            )

        connection.execute(text(update_sql),
                           {"capacity": body.capacity, "section_id": section_id})

        class_section = connection.execute(
                    text(class_sql),
                    {'section_id': section_id},
                ).mappings().first()

        return {
            'message': 'update capacity thanh cong',
            'capacity': body.capacity,
            'class_id': section_id,
            'remaining': class_section["remaining"]
        }


        
        
