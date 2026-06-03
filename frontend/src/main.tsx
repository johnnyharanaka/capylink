import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import Redirect from "./components/Redirect";

// No router: GitHub Pages serves index.html for every path (via 404.html).
// Root path → the shortener UI; a /{slug} path → resolve + redirect in the browser.
const path = window.location.pathname.slice(1);
const slug = /^[A-Za-z0-9]+$/.test(path) ? path : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>{slug ? <Redirect slug={slug} /> : <App />}</StrictMode>,
);
