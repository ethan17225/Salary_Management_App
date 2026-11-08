import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(req: Request, { params }: RouteContext): Promise<Response> {
  const { path } = await params;
  const res = await db.proxy(path.join('/'), req);
  const headers = new Headers();
  for (const k of ['content-type', 'content-disposition', 'cache-control']) {
    const v = res.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(await res.arrayBuffer(), { status: res.status, headers });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };

