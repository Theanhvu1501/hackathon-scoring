import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Shell from '@/components/Shell';
export default async function JudgeLayout({ children }:{ children:React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  if (u.role !== 'judge') redirect('/admin');
  return <Shell role="judge">{children}</Shell>;
}
