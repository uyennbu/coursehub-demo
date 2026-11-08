export default function EventHistory({
    events = [],
    studentId,
    loading = false,
    page = 0,
    pageSize = 5,
    onPageChange,
    disabled = false,
}) {
    function formatDate(isoString) {
        if (!isoString) return "";
        const d = new Date(isoString);
        return isNaN(d.getTime()) ? isoString : d.toLocaleString("vi-VN");
    }

    return (
        <div>
            <p className="muted">
                Nhật ký sự kiện (nguồn: <strong>API</strong>) của sinh viên <strong>{studentId}</strong> (phân trang {pageSize} bản ghi/lần).
            </p>

            {loading ? (
                <p className="muted">Đang tải nhật ký sự kiện...</p>
            ) : events.length === 0 ? (
                <p className="muted">Sinh viên chưa có sự kiện đăng ký nào.</p>
            ) : (
                <>
                    <div className="table-scroll">
                        <table aria-label="Nhật ký sự kiện đăng ký">
                            <thead>
                                <tr>
                                    <th>Thời gian</th>
                                    <th>Lớp học phần</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((evt) => (
                                    <tr key={evt.id}>
                                        <td>{formatDate(evt.occurred_at)}</td>
                                        <td>
                                            <strong>{evt.class_section_id}</strong>
                                        </td>
                                        <td>
                                            <span className={evt.event_type === "CREATED" ? "badge" : "badge danger"}>
                                                {evt.event_type === "CREATED" ? "Đăng ký" : "Hủy đăng ký"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <button
                            type="button"
                            className="secondary"
                            disabled={disabled || loading || page === 0}
                            onClick={() => onPageChange(page - 1)}
                        >
                            ← Trang trước
                        </button>
                        <span className="pagination-info">
                            Trang {page + 1}
                        </span>
                        <button
                            type="button"
                            className="secondary"
                            disabled={disabled || loading || events.length < pageSize}
                            onClick={() => onPageChange(page + 1)}
                        >
                            Trang sau →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

