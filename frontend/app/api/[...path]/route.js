export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

async function proxy(req, { params }) {
  const { path } = await params;
  const res = await fetch(`${BACKEND}/api/${path.join("/")}`, {
    method: req.method,
    headers: req.headers.get("content-type") ? { "content-type": req.headers.get("content-type") } : {},
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    cache: "no-store",
  });
  const headers = new Headers();
  for (const k of ["content-type", "content-disposition", "cache-control"]) {
    const v = res.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(await res.arrayBuffer(), { status: res.status, headers });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };

