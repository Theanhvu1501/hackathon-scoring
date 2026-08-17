'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import Confetti from '@/components/Confetti';
import AmbientNet from '@/components/board/AmbientNet';
import RevealStage from '@/components/board/RevealStage';
import { buildMockResults } from '@/lib/mock-board';

const EVENT = 'Automotive Hackathon 2026';
const SESSION = 'Vòng chung kết · Công bố kết quả';
const TAGLINE = 'SHAPE THE AI-DEFINED MOBILITY ERA';

export type MockMode = 'reveal' | 'champion' | 'wait' | null;

/** Ba màn hình toàn khung. `stage` là đội đang được công bố. */
type Screen = 'banner' | 'wait' | 'stage';
function screenOf(d: any): Screen {
  if (!d || d.state === 'waiting') return d?.bannerImageUrl ? 'banner' : 'wait';
  return 'stage';
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
  const [celebrate, setCelebrate] = useState(0);

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
    es.addEventListener('reveal', load);
    es.addEventListener('update', load);
    return () => { alive = false; es.close(); };
  }, [mock]);

  // ---- Screen crossfade -------------------------------------------------
  // Đổi đội đang chiếu cũng là một lần đổi màn: bản cũ đóng băng và mờ dần trên
  // bản mới, nên không bao giờ có cú cắt giữa lúc cả phòng đang nhìn.
  const screen = screenOf(data);
  const stageKey = screen === 'stage' ? data?.currentTeamId ?? '' : screen;
  const [leaving, setLeaving] = useState<{ screen: Screen; data: any } | null>(null);
  const lastKey = useRef<string>(stageKey);
  const lastScreen = useRef<Screen>(screen);
  const lastData = useRef<any>(data);

  useEffect(() => {
    if (lastKey.current === stageKey) { lastData.current = data; return; }
    setLeaving({ screen: lastScreen.current, data: lastData.current });
    lastKey.current = stageKey;
    lastScreen.current = screen;
    lastData.current = data;
    const id = setTimeout(() => setLeaving(null), XFADE_MS);
    return () => clearTimeout(id);
  }, [stageKey, screen, data]);

  // Hạng nhất là lúc duy nhất bắn confetti — bắn ở mọi đội thì nó thành nền.
  const currentRow = data?.rows?.find((r: any) => r.team.id === data.currentTeamId) ?? null;
  useEffect(() => {
    if (currentRow?.rank === 1) setCelebrate((c) => c + 1);
  }, [currentRow?.team.id, currentRow?.rank]);

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
          <Strip dark={false} label="CHỜ CÔNG BỐ" live={false} />
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

    const rows = (d.rows ?? []) as any[];
    const row = rows.find((r) => r.team.id === d.currentTeamId) ?? rows[0];
    if (!row) {
      return (
        <div key="stage-empty" className={'pitwall' + enter}>
          <AmbientNet />
          <Strip dark={false} label="CHỜ CÔNG BỐ" live={false} />
          <p className="pw-empty">Chưa có đội nào được công bố.</p>
          <StaffLink />
        </div>
      );
    }

    // Bọc trong .pitwall để .pw-login / .pw-mockflag vẫn lấy được token màu của
    // board; .is-stage bỏ nền sáng đi để sân khấu tối tự lo phần nền.
    return (
      <div key={'stage-' + row.team.id} className="pitwall is-stage">
        {row.rank === 1 && entering && <Confetti fire={celebrate} />}
        <RevealStage
          row={row}
          teamCount={d.teamCount ?? rows.length}
          revealedRanks={rows.map((r) => r.rank)}
          maxTotal={d.maxTotal}
          baremTotal={d.baremTotal}
          header={<Strip dark label="ĐANG CÔNG BỐ" live />}
        />
        <StaffLink />
        {mock && <span className="pw-mockflag">MOCK DATA</span>}
      </div>
    );
  };

  if (!data) {
    return (
      <div className="pitwall">
        <Strip dark={false} label="ĐANG KẾT NỐI" live={false} />
        <p className="pw-empty">Đang kết nối bảng điểm…</p>
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

function Strip({ dark, label, live }: { dark: boolean; label: string; live: boolean }) {
  return (
    <header className={'pw-strip' + (dark ? ' on-dark' : '')}>
      <div className="pw-mark">A</div>
      <div className="pw-ident">
        <b>{EVENT}</b>
        <span>{SESSION}</span>
      </div>
      <span className={'pw-state ' + (live ? 'live' : 'wait')}><i />{label}</span>
    </header>
  );
}
