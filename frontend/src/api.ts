// In prod the SPA is on GitHub Pages (link.eiji.dev) and the API is on a
// different origin (api.eiji.dev), so VITE_API_URL points at the backend.
// In dev it stays empty and Vite proxies /api to :8080 (same origin).
const BASE = import.meta.env.VITE_API_URL ?? "";

export type CreateLinkResponse = {
  slug: string;
  shortUrl: string;
  expiresAt: string;
};

export type ResolveLinkResponse = {
  slug: string;
  targetUrl: string;
  expiresAt: string;
};

// Distinguishes the two "link not redirectable" cases so the Redirect screen
// can show the right message. `kind` mirrors the backend's 404 / 410.
export class ResolveError extends Error {
  readonly kind: "not_found" | "expired";
  constructor(kind: "not_found" | "expired") {
    super(kind);
    this.name = "ResolveError";
    this.kind = kind;
  }
}

export async function createLink(url: string): Promise<CreateLinkResponse> {
  const res = await fetch(`${BASE}/api/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function resolveLink(slug: string): Promise<ResolveLinkResponse> {
  const res = await fetch(`${BASE}/api/links/${encodeURIComponent(slug)}`);
  if (res.status === 404) throw new ResolveError("not_found");
  if (res.status === 410) throw new ResolveError("expired");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json();
}
