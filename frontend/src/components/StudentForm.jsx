export default function StudentForm({
    draftId,
    onDraftChange,
    onChange,
    onSubmit,
    onReload,
    onRefresh,
    busy = false,
    loading = false,
}) {
    function handleDraftChange(event) {
        const value = event && event.target !== undefined ? event.target.value : event;
        if (onDraftChange) onDraftChange(value);
        if (onChange) onChange(event);
    }

    const handleReload = onReload || onRefresh;

    return (
        <form className="student-form" onSubmit={onSubmit}>
            <label htmlFor="student-id">Mã sinh viên</label>
            <input
                id="student-id"
                value={draftId}
                maxLength={8}
                required
                inputMode="numeric"
                onChange={handleDraftChange}
                disabled={busy}
            />
            <button type="submit" disabled={busy}>
                Xem đăng ký
            </button>
            <button
                type="button"
                className="secondary"
                disabled={busy || loading}
                onClick={handleReload}
            >
                Tải lại dữ liệu
            </button>
        </form>
    );
}

