'use client';
import { useMemo, useState } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** text used for the free-text search filter */
  filterText?: (row: T) => string;
};

export default function DataTable<T>({
  columns, rows, getId,
  searchable = true, searchPlaceholder = 'Tìm kiếm…',
  pageSize = 8, toolbarRight, filters,
}: {
  columns: Column<T>[];
  rows: T[];
  getId: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbarRight?: React.ReactNode;
  filters?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      columns.some((c) => (c.filterText ? c.filterText(r) : '').toLowerCase().includes(term)),
    );
  }, [q, rows, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pageCount);
  const start = (cur - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return (
    <div className="card">
      {(searchable || toolbarRight || filters) && (
        <div className="table-tools">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            {searchable && (
              <div className="table-search">
                <span className="s-ic">⌕</span>
                <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={searchPlaceholder} />
              </div>
            )}
            {filters}
          </div>
          {toolbarRight}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr><td colSpan={columns.length}><div className="empty-row">Không có dữ liệu</div></td></tr>
            )}
            {slice.map((r) => (
              <tr key={getId(r)}>
                {columns.map((c) => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="pagination">
          <span className="info">Hiển thị {slice.length ? start + 1 : 0}–{start + slice.length} / {filtered.length}</span>
          <div className="page-btns">
            <button className="page-btn" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <button key={p} className={'page-btn ' + (p === cur ? 'on' : '')} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
