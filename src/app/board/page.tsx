'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import Confetti from '@/components/Confetti';
import TimingTower from '@/components/board/TimingTower';
import LeaderBand from '@/components/board/LeaderBand';
import BoardRail from '@/components/board/BoardRail';
import AmbientNet from '@/components/board/AmbientNet';
import { buildMockResults } from '@/lib/mock-board';
import './board.css';

const EVENT = 'Automotive Hackathon 2026';
const SESSION = 'Vòng chung kết · Bảng điểm trực tiếp';
const TAGLINE = 'SHAPE THE AI-DEFINED MOBILITY ERA';

const StaffLink = () => (
  <Link href="/login" className="pw-login">Ban tổ chức · Đăng nhập ↗</Link>
);

/** ?mock=1 | ?mock=final | ?mock=wait — mock board, DB untouched. */
function readMock(): 'live' | 'final' | 'wait' | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('mock');
  if (!v) return null;
  if (v === 'final') return 'final';
  if (v === 'wait') return 'wait';
  return 'live';
}

export default function Board() {
  const [data, setData] = useState<any>(null);
  const [mock, setMock] = useState<'live' | 'final' | 'wait' | null>(null);
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const prevState = useRef<string | null>(null);

  // Mode is resolved after mount so the server render stays stable.
  useEffect(() => { setMock(readMock()); setReady(true); }, []);

  // Live data
  useEffect(() => {
    if (!ready || mock) return;
    let alive = true;
    const load = async () => {
      const d = await fetcher('/api/results');
      if (!alive) return;
      setData(d);
      if (d.state === 'final' && prevState.current !== 'final') setCelebrate((c) => c + 1);
      prevState.current = d.state;
    };
    load();
    const es = new EventSource('/api/stream');
    es.addEventListener('reveal', load);
    es.addEventListener('update', load);
    return () => { alive = false; es.close(); };
  }, [ready, mock]);

  // Mock data — scores drift every few seconds so reordering is visible.
  useEffect(() => {
    if (!ready || !mock) return;
    const state = mock === 'wait' ? 'drafting' : mock === 'final' ? 'final' : 'provisional';
    let tick = 0;
    setData(buildMockResults({ state, tick }));
    if (state === 'final') setCelebrate((c) => c + 1);
    if (state !== 'provisional') return;
    const id = setInterval(() => setData(buildMockResults({ state, tick: ++tick })), 4000);
    return () => clearInterval(id);
  }, [ready, mock]);

  // Session clock in the status strip.
  useEffect(() => {
    const id = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the champion celebration going while the final board is up.
  useEffect(() => {
    if (data?.state !== 'final') return;
    const id = setInterval(() => setCelebrate((c) => c + 1), 9000);
    return () => clearInterval(id);
  }, [data?.state]);

  const mm = String(Math.floor(clock / 60)).padStart(2, '0');
  const ss = String(clock % 60).padStart(2, '0');

  if (!ready || !data) {
    return (
      <div className="pitwall">
        <Strip state="wait" clock={`${mm}:${ss}`} teams="—" scored="—" />
        <div className="pw-main"><p className="pw-empty">Đang kết nối bảng điểm…</p></div>
        <StaffLink />
      </div>
    );
  }

  if (data.state === 'drafting') {
    return (
      <div className="pitwall">
        <AmbientNet />
        <Strip state="wait" clock={`${mm}:${ss}`} teams="—" scored="—" />
        <div className="pw-wait">
          <div className="pw-wait-in">
            <span className="pw-chip">AUTOMOTIVE HACKATHON / 2026</span>
            <h1>Kết quả<br />sắp <em>công bố</em></h1>
            <p className="pw-tagline">{TAGLINE}</p>
            <p>Ban giám khảo đang hoàn tất phiếu chấm. Bảng xếp hạng hiện ngay khi có tín hiệu.</p>
            <div className="pw-rev" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
            </div>
          </div>
        </div>
        <StaffLink />
        {mock && <span className="pw-mockflag">MOCK DATA</span>}
      </div>
    );
  }

  const isFinal = data.state === 'final';
  const rows = data.rows as any[];
  const leader = rows.find((r) => r.score !== null);
  const scoredCount = rows.filter((r) => r.score !== null).length;

  return (
    <div className="pitwall">
      <AmbientNet />
      {isFinal && <Confetti fire={celebrate} />}
      <Strip
        state={isFinal ? 'final' : 'live'}
        clock={`${mm}:${ss}`}
        teams={String(rows.length)}
        scored={`${scoredCount}/${rows.length}`}
      />

      <div className="pw-main">
        <div>
          {leader && (
            <LeaderBand
              row={leader} baremTotal={data.baremTotal}
              isFinal={isFinal} heroImageUrl={data.heroImageUrl}
            />
          )}
          <TimingTower rows={rows} baremTotal={data.baremTotal} criteria={data.criteria} />
        </div>
        <BoardRail
          criteria={data.criteria}
          judges={data.judges}
          teamCount={data.teamCount ?? rows.length}
          isFinal={isFinal}
        />
      </div>

      <StaffLink />
      {mock && <span className="pw-mockflag">MOCK DATA</span>}
    </div>
  );
}

function Strip({ state, clock, teams, scored }: {
  state: 'live' | 'final' | 'wait'; clock: string; teams: string; scored: string;
}) {
  const label = state === 'final' ? 'CHUNG CUỘC' : state === 'live' ? 'TRỰC TIẾP' : 'CHỜ CÔNG BỐ';
  return (
    <header className="pw-strip">
      <div className="pw-mark">A</div>
      <div className="pw-ident">
        <b>{EVENT}</b>
        <span>{SESSION}</span>
      </div>
      <span className={`pw-state ${state}`}><i />{label}</span>
      <div className="pw-strip-meters">
        <div className="pw-meter"><span className="k">Đội</span><span className="v">{teams}</span></div>
        <div className="pw-meter"><span className="k">Đã chấm</span><span className="v">{scored}</span></div>
        <div className="pw-meter"><span className="k">Phiên</span><span className="v">{clock}</span></div>
      </div>
    </header>
  );
}
