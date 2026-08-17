import Link from 'next/link';

/** Dùng cho các trang chỉ Super Admin vào được. Nói rõ vì sao bị chặn thay vì
 *  redirect im lặng hay để trang chết với lỗi fetch 403. */
export default function NoAccess({ what }: { what: string }) {
  return (
    <div className="card card-pad" style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Không có quyền truy cập</h3>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        {what} chỉ dành cho tài khoản <b>Super Admin</b>. Tài khoản của bạn vẫn dùng
        được đầy đủ các mục vận hành: đội thi, giám khảo, barem và điều khiển công bố.
      </p>
      <Link className="btn btn-primary btn-sm" style={{ marginTop: 16 }} href="/admin">
        ← Về tổng quan
      </Link>
    </div>
  );
}
