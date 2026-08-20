import { requireRole } from '@/lib/auth';
import ResetClient from './ResetClient';
import NoAccess from '@/components/NoAccess';

export const dynamic = 'force-dynamic';

export default async function ResetPage() {
  const u = await requireRole('superadmin');
  if (!u) return <NoAccess what="Trang đặt lại sự kiện" />;
  return <ResetClient />;
}
