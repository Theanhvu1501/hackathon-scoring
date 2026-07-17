import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Shell from '@/components/Shell';
export default async function AdminLayout({ children }:{ children:React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  if (u.role !== 'admin') redirect('/judge');
  return <Shell role="admin" userName={u.name}>{children}</Shell>;
}
