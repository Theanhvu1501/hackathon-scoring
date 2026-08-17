import { requireRole } from '@/lib/auth';
import AuditClient from './AuditClient';
import NoAccess from '@/components/NoAccess';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const u = await requireRole('superadmin');
  if (!u) return <NoAccess what="Nhật ký thao tác" />;
  return <AuditClient />;
}
