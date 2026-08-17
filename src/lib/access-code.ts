const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1
export function generateAccessCode(): string {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `${block()}-${block()}`;
}

const CODE_RE = /^[A-Z0-9-]{4,32}$/;

/** Mã LUÔN lưu uppercase: /api/auth/login tra cứu bằng code.trim().toUpperCase(),
 *  nên một mã lưu chữ thường sẽ vĩnh viễn không đăng nhập được. */
export function normalizeAccessCode(raw: string): string {
  return (raw || '').trim().toUpperCase();
}

/** null nghĩa là hợp lệ; ngược lại là câu lỗi hiển thị thẳng cho người dùng.
 *  Không kiểm trùng ở đây — trùng là việc của service vì cần đến DB. */
export function validateAccessCode(code: string): string | null {
  if (!code) return 'Mã truy cập không được để trống';
  if (code.length < 4) return 'Mã truy cập cần ít nhất 4 ký tự';
  if (code.length > 32) return 'Mã truy cập tối đa 32 ký tự';
  if (!CODE_RE.test(code)) return 'Mã chỉ gồm chữ A-Z, số 0-9 và dấu gạch ngang';
  return null;
}
