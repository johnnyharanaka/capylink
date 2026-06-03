import { useState } from "react";
import ThemeToggle from "@/components/actions/ThemeToggle";
import Background from "@/components/layout/Background";
import Logo from "@/components/layout/Logo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { createLink, type CreateLinkResponse } from "@/api";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// The input accepts bare hosts (e.g. "eiji.dev") for convenience, but the
// backend requires an http(s) scheme (@Pattern in CreateLinkRequest), so we
// prefix https:// when the user omits it.
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatCountdown(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export default function App() {
  const [dark, toggle] = useDarkMode();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateLinkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const data = await createLink(normalizeUrl(url));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const expiresAt = result ? new Date(result.expiresAt) : null;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-100 flex flex-col relative overflow-hidden transition-colors">
      <Background dark={dark} />

      <header
        className="px-6 py-3 flex justify-end relative"
        style={{ zIndex: 1 }}
      >
        <ThemeToggle dark={dark} toggle={toggle} />
      </header>

      <main
        className="flex-1 flex flex-col items-center justify-center px-4 gap-5 relative"
        style={{ zIndex: 1 }}
      >
        <h1 className="text-5xl tracking-tight">
          <Logo />
        </h1>
        <p className="text-stone-400 dark:text-stone-500">
          Short URLs that disappear in 21 days.
        </p>

        <form
          onSubmit={submit}
          className="w-full max-w-md flex flex-col gap-3"
          autoComplete="off"
        >
          <input
            className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3 text-lg text-center text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300 dark:focus:ring-stone-600 placeholder:text-stone-300 dark:placeholder:text-stone-600 transition-colors disabled:opacity-60"
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="eiji.dev or https://…"
            aria-label="URL to shorten"
            disabled={busy}
            spellCheck={false}
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-mono text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition-[filter,opacity] shadow-sm shadow-purple-500/20"
          >
            {busy ? (
              <>
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
                  aria-hidden="true"
                />
                shortening…
              </>
            ) : (
              <>shorten</>
            )}
          </button>
        </form>

        {result && expiresAt && (
          <div
            className="w-full max-w-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2"
            style={{ animation: "fade-in 0.25s ease" }}
          >
            <a
              href={result.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 break-all font-mono text-stone-800 dark:text-stone-100 hover:bg-gradient-to-r hover:from-purple-400 hover:to-pink-500 hover:bg-clip-text hover:text-transparent"
            >
              {result.shortUrl.replace(/^https?:\/\//, "")}
            </a>
            <button
              type="button"
              onClick={copy}
              className={`text-xs font-mono px-2.5 py-1 rounded-md border transition-colors ${
                copied
                  ? "border-purple-400 text-purple-500 dark:border-purple-300 dark:text-purple-300"
                  : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700"
              }`}
            >
              {copied ? "copied" : "copy"}
            </button>
            <p className="basis-full m-0 text-xs font-mono text-stone-400 dark:text-stone-500">
              expires {dateFmt.format(expiresAt)} ·{" "}
              {formatCountdown(expiresAt)}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="w-full max-w-md text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2"
            style={{ animation: "fade-in 0.2s ease" }}
          >
            {error}
          </div>
        )}
      </main>

      <footer
        className="absolute bottom-3 left-0 right-0 flex justify-center"
        style={{ zIndex: 1 }}
      >
        <span className="text-xs text-stone-400/60 dark:text-stone-600/60 font-mono tracking-wider select-none">
          21 days · then gone
        </span>
      </footer>
    </div>
  );
}
