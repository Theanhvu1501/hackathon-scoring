import { prisma } from '@/lib/db';
import { generateAccessCode, normalizeAccessCode, validateAccessCode } from '@/lib/access-code';

export type SetCodeResult = { ok: true; code: string } | { ok: false; error: string };

/** Dùng chung cho tài khoản BGK và tài khoản quản trị. */
export async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = generateAccessCode();
    if (!(await prisma.user.findUnique({ where: { accessCode: c } }))) return c;
  }
  return generateAccessCode() + Math.floor(Math.random() * 9);
}

/**
 * Đặt mã bằng tay. Trả về lỗi rõ ràng thay vì ghi đè im lặng: mã trùng hoặc sai
 * định dạng là chuyện người dùng cần biết ngay, không phải chuyện để đoán.
 */
export async function setUserAccessCode(id: string, raw: string): Promise<SetCodeResult> {
  const code = normalizeAccessCode(raw);
  const err = validateAccessCode(code);
  if (err) return { ok: false, error: err };
  const owner = await prisma.user.findUnique({ where: { accessCode: code }, select: { id: true } });
  // Đặt lại đúng mã đang dùng của chính mình thì không phải là trùng.
  if (owner && owner.id !== id) return { ok: false, error: 'Mã này đã có tài khoản khác dùng' };
  await prisma.user.update({ where: { id }, data: { accessCode: code } });
  return { ok: true, code };
}

export async function regenerateUserCode(id: string) {
  return prisma.user.update({ where: { id }, data: { accessCode: await uniqueCode() } });
}
