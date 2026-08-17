import { requireRole } from '@/lib/auth';
import AccountsClient from './AccountsClient';
import NoAccess from '@/components/NoAccess';

// Chốt ở tầng server: admin khách hàng gõ thẳng URL này thì thấy thông báo rõ
// ràng chứ không phải một trang lỗi fetch. API cũng gate riêng — hai lớp.
export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const u = await requireRole('superadmin');
  if (!u) return <NoAccess what="Trang quản lý tài khoản quản trị" />;
  return <AccountsClient />;
}
