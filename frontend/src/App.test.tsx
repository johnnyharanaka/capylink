import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replace the WebGL Background with a no-op so jsdom does not try to spin up Three.js.
vi.mock("@/components/layout/Background", () => ({
  default: () => null,
}));

import App from "./App";

function mockFetchOnce(body: object | string, init: ResponseInit = { status: 201 }) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const response = new Response(payload, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the brand, tagline, input and shorten button", () => {
    render(<App />);
    // The logo text is split across multiple <span>s for the gradient — match
    // on the parent <h1>'s textContent.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "</capylink>",
    );
    expect(
      screen.getByText(/short urls that disappear in 21 days/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/url to shorten/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^shorten$/i })).toBeInTheDocument();
  });

  it("disables the shorten button until the user types a URL", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /^shorten$/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/url to shorten/i), {
      target: { value: "https://example.com" },
    });
    expect(button).not.toBeDisabled();
  });

  it("submits the URL and renders the short link, expiry date and countdown", async () => {
    const expiresAt = new Date(Date.now() + 21 * 86_400_000).toISOString();
    mockFetchOnce({
      slug: "abc1234",
      shortUrl: "http://localhost:8080/abc1234",
      expiresAt,
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/url to shorten/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^shorten$/i }));

    const link = await screen.findByRole("link", {
      name: "localhost:8080/abc1234",
    });
    expect(link).toHaveAttribute("href", "http://localhost:8080/abc1234");
    // Multiple ancestors include the meta paragraph's text — assert on the
    // body content directly so we don't get a "multiple elements" error.
    expect(document.body.textContent).toMatch(/expires/i);
    expect(document.body.textContent).toMatch(/in 20 days|in 21 days/);
  });

  it("submits when the user presses Enter inside the input", async () => {
    const fetchMock = mockFetchOnce({
      slug: "viaenter",
      shortUrl: "http://localhost:8080/viaenter",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    render(<App />);
    const input = screen.getByLabelText(/url to shorten/i);
    fireEvent.change(input, { target: { value: "https://example.com/keys" } });
    // Enter inside an <input> in a <form> with a submit button triggers form submission.
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await screen.findByRole("link", { name: "localhost:8080/viaenter" });
  });

  it("renders the server error when the request fails", async () => {
    mockFetchOnce("URL must start with http:// or https://", { status: 400 });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/url to shorten/i), {
      target: { value: "https://nope" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^shorten$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/URL must start with http/);
  });

  it("copies the short URL to the clipboard and flips the button label", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    mockFetchOnce({
      slug: "copyme1",
      shortUrl: "http://localhost:8080/copyme1",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText(/url to shorten/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^shorten$/i }));
    await screen.findByRole("link", { name: "localhost:8080/copyme1" });

    fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("http://localhost:8080/copyme1"),
    );
    expect(
      await screen.findByRole("button", { name: /^copied$/i }),
    ).toBeInTheDocument();
  });
});
