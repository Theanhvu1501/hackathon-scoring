'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';

type Team = { id: string; name: string; code: string; tag?: string | null; members?: any[] };

export default function JudgeTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all');

  async function load() {
    const [t, status] = await Promise.all([
      fetcher<Team[]>('/api/teams'),
      fetcher<{ submittedTeamIds: string[] }>('/api/scores/status'),
    ]);
    setTeams(t);
    setDoneIds(new Set(status.submittedTeamIds));
  }
  useEffect(() => { load(); }, []);

  const doneCount = teams.filter((t) => doneIds.has(t.id)).length;
  const shown = useMemo(() => teams.filter((t) =>
    filter === 'all' ? true : filter === 'done' ? doneIds.has(t.id) : !doneIds.has(t.id)), [teams, doneIds, filter]);

  return (
    <>
      <div className="page-head">
        <p className="page-desc">Chọn đội để chấm điểm. Đội đã nộp điểm được đánh dấu <b style={{ color: 'var(--green)' }}>✓ Đã chấm</b>. Bạn chỉ thấy điểm của mình cho tới khi công bố.</p>
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tất cả ({teams.length})</button>
          <button className={filter === 'done' ? 'on' : ''} onClick={() => setFilter('done')}>Đã chấm ({doneCount})</button>
          <button className={filter === 'todo' ? 'on' : ''} onClick={() => setFilter('todo')}>Chưa chấm ({teams.length - doneCount})</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {shown.map((t) => {
          const done = doneIds.has(t.id);
          return (
            <Link key={t.id} href={'/judge/score/' + t.id} className="card card-pad" style={{ cursor: 'pointer', borderColor: done ? 'rgba(31,157,85,.4)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div className="tcell">
                  <span className="team-ava" style={{ background: done ? 'var(--green)' : 'var(--blue)' }}>{t.code}</span>
                  <div><b style={{ fontFamily: 'Space Grotesk', fontSize: 16 }}>{t.name}</b>
                    <small style={{ display: 'block', color: 'var(--muted-2)' }}>{t.members?.length || 0} thành viên</small></div>
                </div>
                <span className={'pill ' + (done ? 'done' : 'pending')}>{done ? 'Đã chấm' : 'Chưa chấm'}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 14 }}>{t.tag}</p>
            </Link>
          );
        })}
        {shown.length === 0 && <div className="card card-pad" style={{ color: 'var(--muted-2)' }}>Không có đội nào.</div>}
      </div>
    </>
  );
}
