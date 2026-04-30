import { afterEach, describe, expect, it, vi } from "vitest";
import { createLink } from "./api";

describe("createLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs JSON to /api/links and returns the parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          slug: "abc1234",
          shortUrl: "http://localhost:8080/abc1234",
          expiresAt: "2026-05-20T10:00:00Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLink("https://example.com");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/links");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ url: "https://example.com" });

    expect(result).toEqual({
      slug: "abc1234",
      shortUrl: "http://localhost:8080/abc1234",
      expiresAt: "2026-05-20T10:00:00Z",
    });
  });

  it("throws with the response body when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("URL must start with http:// or https://", {
          status: 400,
          statusText: "Bad Request",
        }),
      ),
    );

    await expect(createLink("not a url")).rejects.toThrow(
      /URL must start with http/,
    );
  });

  it("falls back to status text when the body is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", { status: 503, statusText: "Service Unavailable" }),
      ),
    );

    await expect(createLink("https://example.com")).rejects.toThrow(
      /503 Service Unavailable/,
    );
  });
});
