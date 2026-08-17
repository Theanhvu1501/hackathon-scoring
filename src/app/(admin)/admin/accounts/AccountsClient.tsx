'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Account = {
  id: string; name: string; role: 'superadmin' | 'admin';
  accessCode: string; active: boolean; createdAt: string;
};

export default function AccountsClient() {
  const [rows, setRows] = useState<Account[]>([]);
  const [modal, setModal] = useState<null | 'add' | Account>(null);
  const [form, setForm] = useState<{ name: string; role: 'superadmin' | 'admin'; accessCode: string }>(
    { name: '', role: 'admin', accessCode: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  async function load() { setRows(await fetcher('/api/accounts')); }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm({ name: '', role: 'admin', accessCode: '' }); setErr(''); setModal('add'); }
  function openEdit(a: Account) { setForm({ name: a.name, role: a.role, accessCode: a.accessCode }); setErr(''); setModal(a); }

  async function save() {
    if (!form.name.trim()) return;
    const a = modal !== 'add' && modal ? (modal as Account) : null;
    if (a && form.accessCode !== a.accessCode) {
      if (!(await confirm({
        title: 'Đổi mã truy cập',
        message: `Mã ${a.accessCode} sẽ hết hiệu lực ngay. Người dùng phải đăng nhập bằng mã mới. Xác nhận?`,
        confirmText: 'Đổi mã', danger: true,
      }))) return;
    }
    setBusy(true); setErr('');
    try {
      if (modal === 'add') {
        await fetcher('/api/accounts', {
          method: 'POST', body: JSON.stringify({ name: form.name.trim(), role: form.role }),
        });
      } else if (a) {
        await fetcher('/api/accounts/' + a.id, {
          method: 'PATCH', body: JSON.stringify({ name: form.name.trim(), accessCode: form.accessCode }),
        });
      }
      setModal(null); await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function regen(a: Account) {
    if (!(await confirm({
      title: 'Đổi mã truy cập',
      message: `Sinh mã mới cho "${a.name}". Mã hiện tại ${a.accessCode} hết hiệu lực ngay. Xác nhận?`,
      confirmText: 'Đổi mã', danger: true,
    }))) return;
    setErr('');
    try { await fetcher('/api/accounts/' + a.id, { method: 'POST', body: JSON.stringify({ action: 'regen' }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function toggleActive(a: Account) {
    if (a.active && !(await confirm({
      title: 'Khoá tài khoản',
      message: `Khoá "${a.name}"? Người này không đăng nhập được nữa cho tới khi được mở lại. Mã truy cập giữ nguyên.`,
      confirmText: 'Khoá', danger: true,
    }))) return;
    setErr('');
    try { await fetcher('/api/accounts/' + a.id, { method: 'PATCH', body: JSON.stringify({ active: !a.active }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function del(a: Account) {
    if (!(await confirm({
      title: 'Xoá tài khoản', danger: true, confirmText: 'Xoá',
      message: `Xoá tài khoản "${a.name}"? Người này sẽ không đăng nhập được nữa. `
             + `Nhật ký thao tác cũ vẫn giữ tên họ.`,
    }))) return;
    setErr('');
    try { await fetcher('/api/accounts/' + a.id, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  const columns: Column<Account>[] = [
    { key: 'name', header: 'Tài khoản', filterText: (a) => a.name, render: (a) => (
      <span>
        <b>{a.name}</b>{' '}
        <span className="badge-head">{a.role === 'superadmin' ? 'Super Admin' : 'Admin'}</span>
      </span>
    ) },
    { key: 'code', header: 'Mã truy cập', filterText: (a) => a.accessCode,
      render: (a) => <span className="code-chip">{a.accessCode}</span> },
    { key: 'active', header: 'Trạng thái', render: (a) => (
      <span className={'pill ' + (a.active ? 'done' : 'pending')}>{a.active ? 'Hoạt động' : 'Đã khoá'}</span>
    ) },
    { key: 'created', header: 'Ngày tạo',
      render: (a) => new Date(a.createdAt).toLocaleDateString('vi-VN') },
    { key: 'act', header: 'Thao tác', align: 'right', render: (a) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-sm" onClick={() => openEdit(a)}>Sửa</button>{' '}
        <button className="btn btn-sm" onClick={() => regen(a)}>↻ Đổi mã</button>{' '}
        <button className="btn btn-sm" onClick={() => toggleActive(a)}>{a.active ? 'Khoá' : 'Mở'}</button>{' '}
        <button className="btn btn-sm btn-danger" onClick={() => del(a)}>Xoá</button>
      </span>
    ) },
  ];

  return (
    <>
      <div className="note" style={{ marginBottom: 16 }}>
        <span>◉</span>
        <div>
          <b style={{ color: 'var(--text)' }}>Admin</b> làm được mọi việc vận hành nhưng không thấy
          nhật ký thao tác và không mở được trang này. <b style={{ color: 'var(--text)' }}>Super Admin</b> thì thấy tất cả.
          Vai trò không sửa được sau khi tạo — cần đổi thì xoá rồi tạo lại.
        </div>
      </div>

      {err && !modal && (
        <div className="note" style={{ marginBottom: 14 }}><span>!</span><div>{err}</div></div>
      )}

      <DataTable
        columns={columns} rows={rows} getId={(a) => a.id}
        searchPlaceholder="Tìm theo tên hoặc mã…"
        toolbarRight={<button className="btn btn-primary" onClick={openAdd}>＋ Thêm tài khoản</button>}
      />

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm tài khoản quản trị' : 'Sửa tài khoản'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn" onClick={() => setModal(null)}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {modal === 'add' ? 'Thêm' : 'Lưu'}
            </button>
          </>}
        >
          <div className="field">
            <label>Tên tài khoản</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {modal === 'add' ? (
            <div className="field">
              <label>Vai trò</label>
              <select className="input" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'superadmin' })}>
                <option value="admin">Admin — vận hành, không thấy nhật ký thao tác</option>
                <option value="superadmin">Super Admin — toàn quyền</option>
              </select>
              <div className="hint">Mã truy cập sẽ tự sinh sau khi tạo.</div>
            </div>
          ) : (
            <div className="field">
              <label>Mã truy cập</label>
              <input className="input" value={form.accessCode}
                style={{ fontFamily: 'monospace', letterSpacing: '.08em' }}
                onChange={(e) => setForm({ ...form, accessCode: e.target.value.toUpperCase() })} />
              <div className="hint">4–32 ký tự, chỉ A–Z, 0–9 và dấu gạch ngang.</div>
            </div>
          )}

          {err && <div className="hint" style={{ marginTop: 10, color: 'var(--red, #c0392b)' }}>{err}</div>}
        </Modal>
      )}
    </>
  );
}
