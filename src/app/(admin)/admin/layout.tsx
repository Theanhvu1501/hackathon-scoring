import { redirect } from 'next/navigation';
import { getCurrentUser, isAdminish } from '@/lib/auth';
import Shell from '@/components/Shell';
export default async function AdminLayout({ children }:{ children:React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  if (!isAdminish(u)) redirect('/judge');
  return <Shell role={u.role} userName={u.name}>{children}</Shell>;
}
