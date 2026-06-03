import { useEffect, useState } from "react";
import Background from "@/components/layout/Background";
import Logo from "@/components/layout/Logo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { resolveLink, ResolveError } from "@/api";

type State =
  | { status: "resolving" }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "error"; message: string };

// Client-side redirect screen. GitHub Pages serves the SPA for /{slug} paths
// (via the 404.html fallback); this resolves the slug against the API and
// sends the browser to the target. Note: link-preview bots that don't run JS
// won't follow this — that tradeoff is inherent to hosting on Pages.
export default function Redirect({ slug }: { slug: string }) {
  const [dark] = useDarkMode();
  const [state, setState] = useState<State>({ status: "resolving" });

  useEffect(() => {
    let cancelled = false;
    resolveLink(slug)
      .then((link) => {
        if (cancelled) return;
        // Defense-in-depth: the backend only mints http(s) targets, but never
        // hand the browser a javascript:/data: URL even if a stale row or a
        // tampered response slips through.
        if (!/^https?:\/\//i.test(link.targetUrl)) {
          setState({ status: "error", message: "Unsafe redirect target." });
          return;
        }
        window.location.replace(link.targetUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ResolveError) {
          setState({ status: err.kind });
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-100 flex flex-col relative overflow-hidden transition-colors">
      <Background dark={dark} />

      <main
        className="flex-1 flex flex-col items-center justify-center px-4 gap-5 relative text-center"
        style={{ zIndex: 1 }}
      >
        <h1 className="text-4xl tracking-tight">
          <Logo />
        </h1>

        {state.status === "resolving" && (
          <p className="text-stone-400 dark:text-stone-500 inline-flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 rounded-full border-2 border-stone-300 dark:border-stone-600 border-t-transparent animate-spin"
              aria-hidden="true"
            />
            taking you there…
          </p>
        )}

        {state.status === "not_found" && (
          <Message
            title="link not found"
            detail="This short link doesn’t exist (or never did)."
          />
        )}

        {state.status === "expired" && (
          <Message
            title="link expired"
            detail="capylink links live for 21 days, then disappear."
          />
        )}

        {state.status === "error" && (
          <Message title="something went wrong" detail={state.message} />
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

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-3" style={{ zIndex: 1 }}>
      <p className="text-stone-500 dark:text-stone-400">
        <span className="font-mono">{title}</span>
        <br />
        <span className="text-sm text-stone-400 dark:text-stone-500">
          {detail}
        </span>
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-mono text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 transition-[filter] shadow-sm shadow-purple-500/20"
      >
        shorten a link
      </a>
    </div>
  );
}
