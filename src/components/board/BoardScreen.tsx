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

const EVENT = 'Automotive Hackathon 2026';
const SESSION = 'Vòng chung kết · Bảng điểm trực tiếp';
const TAGLINE = 'SHAPE THE AI-DEFINED MOBILITY ERA';

export type MockMode = 'live' | 'final' | 'wait' | null;

/** Which of the three full-screen views the current payload maps to. */
type Screen = 'banner' | 'wait' | 'board';
function screenOf(d: any): Screen {
  if (!d || d.state === 'drafting') return d?.bannerImageUrl ? 'banner' : 'wait';
  return 'board';
}

// The outgoing view lingers this long as a fading overlay. Must stay above the
// pw-fade-out duration in board.css, or the old screen snaps away mid-fade.
const XFADE_MS = 760;

const StaffLink = () => (
  <Link href="/login" className="pw-login">Ban tổ chức · Đăng nhập ↗</Link>
);

export default function BoardScreen({ initial, mock }: { initial: any; mock: MockMode }) {
  // Seeded from the server render, so the very first paint is already the real
  // screen — no "đang kết nối" flash before the banner appears.
  const [data, setData] = useState<any>(initial);
  const [clock, setClock] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const prevState = useRef<string | null>(null);

  // Live data
  useEffect(() => {
    if (mock) return;
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
  }, [mock]);

  // Mock data — scores drift every few seconds so reordering is visible.
  useEffect(() => {
    if (!mock) return;
    const state = mock === 'wait' ? 'drafting' : mock === 'final' ? 'final' : 'provisional';
    if (state === 'final') setCelebrate((c) => c + 1);
    if (state !== 'provisional') return;
    let tick = 0;
    const id = setInterval(() => setData(buildMockResults({ state, tick: ++tick })), 4000);
    return () => clearInterval(id);
  }, [mock]);

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

  // ---- Screen crossfade -------------------------------------------------
  // Going from the banner to the live board is the moment the room is watching,
  // so the swap must not be a cut. The outgoing view is frozen (its own data
  // snapshot) and fades out on top while the new one fades up underneath.
  const screen = screenOf(data);
  const [leaving, setLeaving] = useState<{ screen: Screen; data: any } | null>(null);
  const lastScreen = useRef<Screen>(screen);
  const lastData = useRef<any>(data);

  useEffect(() => {
    if (lastScreen.current === screen) { lastData.current = data; return; }
    setLeaving({ screen: lastScreen.current, data: lastData.current });
    lastScreen.current = screen;
    lastData.current = data;
    const id = setTimeout(() => setLeaving(null), XFADE_MS);
    return () => clearTimeout(id);
  }, [screen, data]);

  const mm = String(Math.floor(clock / 60)).padStart(2, '0');
  const ss = String(clock % 60).padStart(2, '0');
  const clockText = `${mm}:${ss}`;

  const view = (s: Screen, d: any, entering: boolean) => {
    const enter = entering ? ' pw-enter' : '';

    if (s === 'banner') {
      // Keeps the `pitwall` class so .pw-login / .pw-mockflag still resolve the
      // board's CSS variables; .is-banner strips the layout down to the image.
      return (
        // Keyed by screen: React must remount on a screen change, otherwise it
        // patches the same <div> in place and the enter animation never re-runs.
        <div key="banner" className={'pitwall is-banner' + enter}>
          <img className="pw-banner" src={d.bannerImageUrl} alt="" />
          <StaffLink />
          {mock && <span className="pw-mockflag">MOCK DATA</span>}
        </div>
      );
    }

    if (s === 'wait') {
      return (
        <div key="wait" className={'pitwall' + enter}>
          <AmbientNet />
          <Strip state="wait" clock={clockText} teams="—" scored="—" />
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

    const isFinal = d.state === 'final';
    const rows = d.rows as any[];
    const leader = rows.find((r) => r.score !== null);
    const scoredCount = rows.filter((r) => r.score !== null).length;

    return (
      <div key="board" className={'pitwall' + enter}>
        <AmbientNet />
        {isFinal && entering && <Confetti fire={celebrate} />}
        <Strip
          state={isFinal ? 'final' : 'live'}
          clock={clockText}
          teams={String(rows.length)}
          scored={`${scoredCount}/${rows.length}`}
        />

        <div className="pw-main">
          <div>
            {leader && (
              <LeaderBand
                row={leader} maxTotal={d.maxTotal}
                isFinal={isFinal} heroImageUrl={d.heroImageUrl}
              />
            )}
            <TimingTower
              rows={rows} maxTotal={d.maxTotal} baremTotal={d.baremTotal}
              criteria={d.criteria} interactive={entering}
            />
          </div>
          <BoardRail
            criteria={d.criteria}
            judges={d.judges}
            teamCount={d.teamCount ?? rows.length}
            isFinal={isFinal}
          />
        </div>

        <StaffLink />
        {mock && <span className="pw-mockflag">MOCK DATA</span>}
      </div>
    );
  };

  if (!data) {
    return (
      <div className="pitwall">
        <Strip state="wait" clock={clockText} teams="—" scored="—" />
        <div className="pw-main"><p className="pw-empty">Đang kết nối bảng điểm…</p></div>
        <StaffLink />
      </div>
    );
  }

  return (
    <>
      {view(screen, data, true)}
      {leaving && <div className="pw-xfade" aria-hidden>{view(leaving.screen, leaving.data, false)}</div>}
    </>
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
