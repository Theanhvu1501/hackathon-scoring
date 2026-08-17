import BoardScreen, { type MockMode } from '@/components/board/BoardScreen';
import { getResults } from '@/lib/services/reveal';
import { buildMockResults } from '@/lib/mock-board';
import './board.css';

// Rendered per request on the server so the first paint is already the real
// screen. Resolving the state on the client instead is what made the board
// flash "đang kết nối" (or the text waiting screen) before the banner appeared.
export const dynamic = 'force-dynamic';

/** ?mock=1 | ?mock=champion | ?mock=wait — mock board, DB untouched.
 *  `reveal` là một đội giữa bảng đang được công bố; `champion` là hạng nhất. */
function readMock(v?: string | string[]): MockMode {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  if (raw === 'champion' || raw === 'final' || raw === 'judges') return 'champion';
  if (raw === 'wait') return 'wait';
  return 'reveal';
}

export default async function BoardPage({
  searchParams,
}: { searchParams: { mock?: string | string[] } }) {
  const mock = readMock(searchParams?.mock);
  const initial = mock
    ? buildMockResults(
        mock === 'wait' ? { state: 'waiting' }
        // champion: đã công bố hết, đội đang chiếu là hạng nhất.
        : mock === 'champion' ? { state: 'revealing', revealedCount: 12 }
        : { state: 'revealing', revealedCount: 9 },
      )
    // A DB blip must never take the board down mid-event: fall back to a null
    // payload and let the client fetch /api/results and retry, as it did before.
    : await getResults().catch(() => null);

  return <BoardScreen initial={initial} mock={mock} />;
}
