import { NextRequest, NextResponse } from 'next/server';

// Runtime reverse-proxy: forwards every /api/* request to the backend, reading
// BACKEND_URL at REQUEST time (unlike next.config rewrites, which bake the value
// in at build time). This is what makes the deployed URL configurable per env.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const backendBase = () => (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');

// Hop-by-hop headers must not be forwarded (RFC 7230 §6.1).
const STRIP_REQ = ['host', 'connection', 'content-length'];
const STRIP_RES = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];

async function proxy(req: NextRequest, ctx: { params: { path: string[] } }): Promise<Response> {
  const path = ctx.params.path.join('/');
  const target = `${backendBase()}/api/${path}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  STRIP_REQ.forEach((h) => headers.delete(h));

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.arrayBuffer();
    if (body.byteLength) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: 'Bad gateway', message: 'Backend unreachable' }, { status: 502 });
  }

  const resHeaders = new Headers(upstream.headers);
  STRIP_RES.forEach((h) => resHeaders.delete(h));

  // Preserve every Set-Cookie separately (a plain Headers copy can collapse them).
  resHeaders.delete('set-cookie');
  const res = new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
  const cookies = (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of cookies) res.headers.append('set-cookie', c);
  return res;
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
  proxy as HEAD,
};
