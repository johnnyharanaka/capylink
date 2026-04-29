const BASE = import.meta.env.VITE_API_URL ?? "";

export type CreateLinkResponse = {
  slug: string;
  shortUrl: string;
  expiresAt: string;
};

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
