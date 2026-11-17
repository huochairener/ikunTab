// 密码哈希：与 Python 端 passlib(bcrypt) 数据库字段完全兼容。
// bcryptjs 是纯 JS 实现，边缘函数/Node 运行时都能用（无需原生编译）。
import { BizError } from './http.js';

let bcryptModule = null;

async function bcrypt() {
  if (!bcryptModule) {
    const mod = await import('bcryptjs');
    bcryptModule = mod.default ?? mod;
  }
  return bcryptModule;
}

/** 新密码强度校验（与 Python 端 _check_password 一致） */
export function checkPassword(raw) {
  if (typeof raw !== 'string' || raw.length < 6) {
    throw new BizError('密码至少 6 位', 400);
  }
  if (new TextEncoder().encode(raw).length > 72) {
    throw new BizError('密码过长，UTF-8 编码后不能超过 72 字节（bcrypt 上限）', 400);
  }
}

/** 生成 bcrypt hash（$2b$ 格式，Python 端可校验） */
export async function hashPassword(raw) {
  const lib = await bcrypt();
  const rounds = 10;
  if (typeof lib.hashSync === 'function') return lib.hashSync(raw, rounds);
  return lib.hash(raw, rounds);
}

/** 校验密码；异常按“密码错误”处理，避免泄露内部细节 */
export async function verifyPassword(raw, hashed) {
  try {
    if (!hashed) return false;
    const lib = await bcrypt();
    if (typeof lib.compareSync === 'function') return Boolean(lib.compareSync(raw, hashed));
    return Boolean(await lib.compare(raw, hashed));
  } catch {
    return false;
  }
}
