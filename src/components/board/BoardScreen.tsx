'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import Confetti from '@/components/Confetti';
import TimingTower from '@/components/board/TimingTower';
import LeaderBand from '@/components/board/LeaderBand';
import BoardRail from '@/components/board/BoardRail';
import AmbientNet from '@/components/board/AmbientNet';
import SpotlightReveal from '@/components/board/SpotlightReveal';
import { buildMockResults } from '@/lib/mock-board';

const EVENT = 'Automotive Hackathon 2026';
const SESSION = 'Vòng chung kết · Bảng điểm trực tiếp';
const TAGLINE = 'SHAPE THE AI-DEFINED MOBILITY ERA';

export type MockMode = 'ranks' | 'judges' | 'wait' | null;

/** Which of the three full-screen views the current payload maps to. */
type Screen = 'banner' | 'wait' | 'board';
function screenOf(d: any): Screen {
  if (!d || d.state === 'waiting') return d?.bannerImageUrl ? 'banner' : 'wait';
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
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  // Live data
  useEffect(() => {
    if (mock) return;
    let alive = true;
    const load = async () => {
      const d = await fetcher('/api/results');
      if (alive) setData(d);
    };
    load();
    const es = new EventSource('/api/stream');
    // Spotlight bám vào SỰ KIỆN, không phải so sánh state giữa hai lần fetch:
    // F5 lại trang board sau khi đã công bố sẽ không chiếu lại màn hình của đội
    // công bố lúc trước.
    es.addEventListener('reveal', (e: MessageEvent) => {
      let p: any = {};
      try { p = JSON.parse(e.data); } catch { /* payload rỗng */ }
      if (p.teamId && !p.undo) setSpotlightId(p.teamId);
      if (p.reset || p.undo) setSpotlightId(null);
      if (p.judges) setCelebrate((c) => c + 1);
      load();
    });
    es.addEventListener('update', load);
    return () => { alive = false; es.close(); };
  }, [mock]);

  // Mock data — scores drift every few seconds so reordering is visible.
  useEffect(() => {
    if (!mock) return;
    const state = mock === 'wait' ? 'waiting' : mock;
    if (state === 'judges') setCelebrate((c) => c + 1);
    if (state !== 'ranks') return;
    let tick = 0;
    const id = setInterval(() => setData(buildMockResults({ state, tick: ++tick })), 4000);
    return () => clearInterval(id);
  }, [mock]);

  // Session clock in the status strip.
  useEffect(() => {
    const id = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the celebration going while the judge scores are up.
  useEffect(() => {
    if (data?.state !== 'judges') return;
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
          <Strip state="waiting" clock={clockText} teams="—" scored="—" />
          <div className="pw-wait">
            <div className="pw-wait-in">
              <span className="pw-chip">AUTOMOTIVE HACKATHON / 2026</span>
              <h1>Kết quả<br />sắp <em>công bố</em></h1>
              <p className="pw-tagline">{TAGLINE}</p>
              <p>Ban giám khảo đã hoàn tất phiếu chấm. Thứ hạng hiện ngay khi ban tổ chức công bố.</p>
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

    const showJudges = d.state === 'judges';
    const rows = d.rows as any[];
    const teamCount = d.teamCount ?? rows.length;
    // Vô địch chỉ khi đã công bố hết: giữa lúc công bố lần lượt, đội trên cùng
    // mới chỉ là đội dẫn đầu trong số đã công bố.
    const allRevealed = rows.length >= teamCount && teamCount > 0;
    const leader = rows.find((r) => r.score !== null);

    return (
      <div key="board" className={'pitwall' + enter}>
        <AmbientNet />
        {allRevealed && entering && <Confetti fire={celebrate} />}
        <Strip
          state={d.state}
          clock={clockText}
          teams={`${rows.length}/${teamCount}`}
          scored={`${rows.filter((r) => r.score !== null).length}/${rows.length}`}
        />

        <div className="pw-main">
          <div>
            {leader && (
              <LeaderBand
                row={leader} maxTotal={d.maxTotal}
                isChampion={allRevealed} heroImageUrl={d.heroImageUrl}
              />
            )}
            <TimingTower
              rows={rows} maxTotal={d.maxTotal} baremTotal={d.baremTotal}
              criteria={d.criteria} interactive={entering} showJudges={showJudges}
            />
          </div>
          <BoardRail
            criteria={d.criteria}
            judges={d.judges}
            teamCount={teamCount}
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
        <Strip state="waiting" clock={clockText} teams="—" scored="—" />
        <div className="pw-main"><p className="pw-empty">Đang kết nối bảng điểm…</p></div>
        <StaffLink />
      </div>
    );
  }

  const spotRow = spotlightId ? data.rows?.find((r: any) => r.team.id === spotlightId) : null;

  return (
    <>
      {view(screen, data, true)}
      {leaving && <div className="pw-xfade" aria-hidden>{view(leaving.screen, leaving.data, false)}</div>}
      {spotRow && (
        <SpotlightReveal row={spotRow} maxTotal={data.maxTotal} onDone={() => setSpotlightId(null)} />
      )}
    </>
  );
}

const STATE_LABEL: Record<string, string> = {
  waiting: 'CHỜ CÔNG BỐ',
  ranks: 'ĐANG CÔNG BỐ',
  judges: 'ĐIỂM BAN GIÁM KHẢO',
};
// Giữ lại class cũ của .pw-state để không phải sửa CSS: ranks dùng style "live",
// judges dùng style "final".
const STATE_CLASS: Record<string, string> = { waiting: 'wait', ranks: 'live', judges: 'final' };

function Strip({ state, clock, teams, scored }: {
  state: string; clock: string; teams: string; scored: string;
}) {
  return (
    <header className="pw-strip">
      <div className="pw-mark">A</div>
      <div className="pw-ident">
        <b>{EVENT}</b>
        <span>{SESSION}</span>
      </div>
      <span className={`pw-state ${STATE_CLASS[state] ?? 'wait'}`}><i />{STATE_LABEL[state] ?? state}</span>
      <div className="pw-strip-meters">
        <div className="pw-meter"><span className="k">Đã công bố</span><span className="v">{teams}</span></div>
        <div className="pw-meter"><span className="k">Đã chấm</span><span className="v">{scored}</span></div>
        <div className="pw-meter"><span className="k">Phiên</span><span className="v">{clock}</span></div>
      </div>
    </header>
  );
}
