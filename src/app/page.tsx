import { redirect } from 'next/navigation';

// The site root shows the public leaderboard. Scoring (/judge) and CMS (/admin)
// require login and are gated by middleware + server-layout role checks.
export default function Home() {
  redirect('/board');
}
