'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';

// Khớp với bảng action trong plan/spec. Action lạ thì hiện nguyên chuỗi thô để
// không bao giờ mất dòng nhật ký chỉ vì thiếu bản dịch.
const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Đăng nhập', 'auth.logout': 'Đăng xuất', 'auth.login_failed': 'Đăng nhập thất bại',
  'team.create': 'Tạo đội', 'team.update': 'Sửa đội', 'team.delete': 'Xoá đội',
  'member.create': 'Thêm thành viên', 'member.update': 'Sửa thành viên', 'member.delete': 'Xoá thành viên',
  'judge.create': 'Thêm giám khảo', 'judge.update': 'Sửa giám khảo', 'judge.delete': 'Xoá giám khảo',
  'judge.regen_code': 'Đổi mã giám khảo', 'judge.set_code': 'Sửa mã giám khảo', 'judge.set_head': 'Đặt Trưởng BGK',
  'account.create': 'Tạo tài khoản', 'account.update': 'Sửa tài khoản', 'account.delete': 'Xoá tài khoản',
  'account.regen_code': 'Đổi mã tài khoản', 'account.set_code': 'Sửa mã tài khoản',
  'criterion.create': 'Thêm tiêu chí', 'criterion.update': 'Sửa tiêu chí', 'criterion.delete': 'Xoá tiêu chí',
  'score.save': 'Lưu nháp điểm', 'score.submit': 'Nộp điểm', 'score.unlock': 'Mở khoá phiếu chấm',
  'reveal.team': 'Công bố đội', 'reveal.unteam': 'Thu hồi đội', 'reveal.judges': 'Công bố điểm BGK',
  'reveal.reset': 'Reset công bố',
  'settings.hero_image': 'Đổi ảnh màn chiếu', 'settings.banner_image': 'Đổi banner',
};

const ENTITIES: [string, string][] = [
  ['', 'Tất cả'], ['auth', 'Đăng nhập'], ['team', 'Đội thi'], ['member', 'Thành viên'],
  ['judge', 'Giám khảo'], ['account', 'Tài khoản'], ['criterion', 'Barem'],
  ['score', 'Điểm'], ['reveal', 'Công bố'], ['settings', 'Cấu hình'],
];

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super Admin', admin: 'Admin', judge: 'Giám khảo',
};

export default function AuditClient() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ page: String(page) });
    if (entity) sp.set('entity', entity);
    if (q.trim()) sp.set('q', q.trim());
    setData(await fetcher('/api/audit?' + sp.toString()));
  }, [page, entity, q]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card">
      <div className="table-tools">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div className="table-search">
            <span className="s-ic">⌕</span>
            <input value={q} placeholder="Tìm theo người thao tác hoặc đối tượng…"
              onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <select className="filter-select" value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
            {ENTITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {data && <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>{data.total} bản ghi</span>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Thời điểm</th><th>Người thao tác</th><th>Hành động</th>
              <th>Đối tượng</th><th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {!data && (
              <tr><td colSpan={5}><div className="loading-box sm"><span className="spin-lg" />Đang tải…</div></td></tr>
            )}
            {data?.entries.map((e: any) => (
              <tr key={e.id}>
                <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(e.createdAt).toLocaleString('vi-VN')}
                </td>
                <td>
                  {e.actorName || <i style={{ color: 'var(--muted-2)' }}>—</i>}
                  {e.actorRole && (
                    <small style={{ display: 'block', color: 'var(--muted-2)' }}>
                      {ROLE_LABEL[e.actorRole] ?? e.actorRole}
                    </small>
                  )}
                </td>
                <td>{ACTION_LABEL[e.action] ?? e.action}</td>
                <td>{e.target || '—'}</td>
                <td style={{ color: 'var(--muted-2)' }}>{e.detail || '—'}</td>
              </tr>
            ))}
            {data?.entries.length === 0 && (
              <tr><td colSpan={5}><div className="empty-row">Không có bản ghi</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="pagination">
          <span className="info">Trang {data.page}/{data.pageCount}</span>
          <div className="page-btns">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            <button className="page-btn" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
