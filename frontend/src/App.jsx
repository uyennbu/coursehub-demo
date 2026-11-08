import { useEffect, useState } from "react";
import { api } from "./api.js";
import Notice from "./components/Notice.jsx";
import SectionTable from "./components/SectionTable.jsx";
import EnrollmentList from "./components/EnrollmentList.jsx";
import StudentForm from "./components/StudentForm.jsx";
import EventHistory from "./components/EventHistory.jsx";

const EVENT_PAGE_SIZE = 5;
const SECTION_PAGE_SIZE = 5;

export default function App() {
    const [draftId, setDraftId] = useState("22000004");
    const [studentId, setStudentId] = useState("22000004");
    const [courses, setCourses] = useState([]);
    const [sections, setSections] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [events, setEvents] = useState([]);
    const [eventPage, setEventPage] = useState(0);
    const [sectionPage, setSectionPage] = useState(0);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [activeTab, setActiveTab] = useState("enroll");
    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState("");
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState({ kind: "info", text: "" });
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        const options = { signal: controller.signal };
        async function loadData() {
            setLoading(true);
            setError("");
            try {
                const sectionParams = new URLSearchParams();
                if (search.trim()) sectionParams.set("q", search.trim());
                if (courseFilter) sectionParams.set("course_code", courseFilter);
                if (onlyAvailable) sectionParams.set("available_only", "true");
                sectionParams.set("skip", String(sectionPage * SECTION_PAGE_SIZE));
                sectionParams.set("limit", String(SECTION_PAGE_SIZE));

                const [courseData, sectionData, enrollmentData] = await Promise.all([
                    api("/courses", options),
                    api(`/sections?${sectionParams.toString()}`, options),
                    api(`/students/${encodeURIComponent(studentId)}/enrollments`,
                        options),
                ]);
                if (controller.signal.aborted) return;
                setCourses(courseData);
                setSections(sectionData);
                setEnrollments(enrollmentData);
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(err.message);
                setCourses([]);
                setSections([]);
                setEnrollments([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        loadData();
        return () => controller.abort();
    }, [studentId, refresh, search, courseFilter, onlyAvailable, sectionPage]);

    useEffect(() => {
        const controller = new AbortController();
        const options = { signal: controller.signal };
        async function loadEvents() {
            setLoadingEvents(true);
            try {
                const skip = eventPage * EVENT_PAGE_SIZE;
                const data = await api(
                    `/enrollment-events?student_id=${encodeURIComponent(studentId)}&source=api&skip=${skip}&limit=${EVENT_PAGE_SIZE}`,
                    options,
                );
                if (controller.signal.aborted) return;
                setEvents(data || []);
            } catch (err) {
                if (controller.signal.aborted) return;
                setEvents([]);
            } finally {
                if (!controller.signal.aborted) setLoadingEvents(false);
            }
        }
        loadEvents();
        return () => controller.abort();
    }, [studentId, eventPage, refresh]);

    function chooseStudent(event) {
        event.preventDefault();
        const nextId = draftId.trim();
        if (!/^\d{8}$/.test(nextId)) {
            setNotice({ kind: "error", text: "Mã demo phải gồm 8 chữ số." });
            return;
        }
        setNotice({ kind: "info", text: "" });
        setLoading(true);
        setEventPage(0);
        setStudentId(nextId);
        setRefresh((value) => value + 1);
    }

    async function changeEnrollment(sectionId, cancel = false) {
        if (busy || loading || error) return;
        if (cancel && !window.confirm(`Hủy đăng ký lớp ${sectionId}?`)) return;
        setBusy(true);
        setNotice({ kind: "info", text: "Đang gửi yêu cầu..." });
        try {
            if (cancel) {
                await api(
                    `/enrollments/${encodeURIComponent(studentId)}/${encodeURIComponent(sectionId)}`,
                    { method: "DELETE" },
                );
            } else {
                await api("/enrollments", {
                    method: "POST",
                    body: { student_id: studentId, class_section_id: sectionId },
                });
            }
            setNotice({
                kind: "success", text: cancel
                    ? `Đã hủy đăng ký ${sectionId}.`
                    : `Đăng ký ${sectionId} thành công.`
            });
        } catch (err) {
            setNotice({ kind: "error", text: err.message });
        } finally {
            // Đồng bộ CSDL khổng cố sau lỗi; không động/trước khi sửa giao diện.
            setLoading(true);
            setRefresh((value) => value + 1);
            setBusy(false);
        }
    }

    const rows = sections.map((section) => ({
        ...section,
        course_name: section.course_name
            ?? courses.find((course) => course.code === section.course_code)?.name
            ?? section.course_code,
        registered: enrollments.some((item) => item.class_section_id ===
            section.class_id),
    }));
    const disabled = loading || busy || Boolean(error);

    return (
        <main className="container">
            <header className="hero">
                <p className="eyebrow">CSDL WEB VÀ HỆ THỐNG THÔNG TIN · BUỔI 5</p>
                <h1>CourseHub</h1>
                <p>Tra cứu và đăng ký lớp học phần</p>
                <span className="chip">React → FastAPI → PostgreSQL</span>
            </header>
            <p className="demo-note">
                Môi trường thực hành. Nhập mã sinh viên để tải dữ liệu, không phải đăng
                nhập.
            </p>
            <section className="panel">
                <h2>1. Chọn sinh viên</h2>
                <StudentForm
                    draftId={draftId}
                    onDraftChange={setDraftId}
                    onSubmit={chooseStudent}
                    onReload={() => setRefresh((value) => value + 1)}
                    busy={busy}
                    loading={loading}
                />
                <p className="muted">Dữ liệu đang xem: <strong>{studentId}</strong>.
                    Mã mẫu: 22000001-22000004.</p>
            </section>
            <Notice kind={notice.kind}>{notice.text}</Notice>
            <Notice kind="error">{error}</Notice>
            {loading && <Notice>Đang tải dữ liệu từ API...</Notice>}
            {!loading && !error && (
                <>
                    <nav className="tabs" aria-label="Chuyển đổi màn hình">
                        <button
                            type="button"
                            className={activeTab === "enroll" ? "tab-btn active" : "tab-btn"}
                            onClick={() => setActiveTab("enroll")}
                        >
                            Đăng ký học phần
                        </button>
                        <button
                            type="button"
                            className={activeTab === "history" ? "tab-btn active" : "tab-btn"}
                            onClick={() => setActiveTab("history")}
                        >
                            Lịch sử đăng ký
                        </button>
                        <button
                            type="button"
                            className={activeTab === "all" ? "tab-btn active" : "tab-btn"}
                            onClick={() => setActiveTab("all")}
                        >
                            Xem tất cả
                        </button>
                    </nav>

                    {(activeTab === "enroll" || activeTab === "all") && (
                        <div className="workspace">
                            <section className="panel">
                                <h2>2. Danh sách lớp học phần</h2>
                                <div className="filters">
                                    <label htmlFor="search">Tìm lớp / học phần</label>
                                    <input
                                        id="search"
                                        value={search}
                                        placeholder="Ví dụ: web"
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setSectionPage(0);
                                        }}
                                    />
                                    <select
                                        id="course-filter"
                                        aria-label="Lọc theo mã học phần"
                                        value={courseFilter}
                                        onChange={(e) => {
                                            setCourseFilter(e.target.value);
                                            setSectionPage(0);
                                        }}
                                    >
                                        <option value="">Tất cả học phần</option>
                                        {courses.map((course) => (
                                            <option key={course.code} value={course.code}>
                                                {course.code} - {course.name}
                                            </option>
                                        ))}
                                    </select>
                                    <label className="check">
                                        <input
                                            type="checkbox"
                                            checked={onlyAvailable}
                                            onChange={(e) => {
                                                setOnlyAvailable(e.target.checked);
                                                setSectionPage(0);
                                            }}
                                        />
                                        Chỉ hiển thị lớp còn chỗ
                                    </label>
                                </div>
                                <SectionTable rows={rows} disabled={disabled}
                                    onEnroll={(id) => changeEnrollment(id)} />

                                <div className="pagination">
                                    <button
                                        type="button"
                                        className="secondary"
                                        disabled={disabled || loading || sectionPage === 0}
                                        onClick={() => setSectionPage((p) => Math.max(0, p - 1))}
                                    >
                                        ← Trang trước
                                    </button>
                                    <span className="pagination-info">
                                        Trang {sectionPage + 1}
                                    </span>
                                    <button
                                        type="button"
                                        className="secondary"
                                        disabled={disabled || loading || sections.length < SECTION_PAGE_SIZE}
                                        onClick={() => setSectionPage((p) => p + 1)}
                                    >
                                        Trang sau →
                                    </button>
                                </div>
                            </section>
                            <section className="panel">
                                <h2>3. Lớp đã đăng ký</h2>
                                <p className="muted">Sinh viên {studentId} · {enrollments.length} lớp</p>

                                <EnrollmentList rows={enrollments} disabled={disabled}
                                    onCancel={(id) => changeEnrollment(id, true)} />
                            </section>
                        </div>
                    )}

                    {(activeTab === "history" || activeTab === "all") && (
                        <section className="panel">
                            <h2>{activeTab === "all" ? "4. Lịch sử sự kiện của sinh viên" : "2. Lịch sử sự kiện của sinh viên"}</h2>
                            <EventHistory
                                events={events}
                                studentId={studentId}
                                loading={loadingEvents}
                                page={eventPage}
                                pageSize={EVENT_PAGE_SIZE}
                                onPageChange={(newPage) => setEventPage(newPage)}
                                disabled={disabled}
                            />
                        </section>
                    )}
                </>
            )}
            <footer>Sổ chữ và đăng ký được độc từ API; Backend quyết định tính hợp lệ.</footer>
        </main>
    );
}