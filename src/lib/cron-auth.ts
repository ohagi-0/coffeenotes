import { timingSafeEqual } from 'node:crypto';

/** 定期ジョブ（GitHub Actions）の合言葉 CRON_SECRET を Authorization: Bearer で照合する */
export function isCronAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
