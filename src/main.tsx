import React from "react";
import ReactDOM from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "@fontsource-variable/inter";
import "./styles.css";
import App from "./App";
import { piDesktopApi } from "./app/desktop/electrobun-api";

window.piDesktop = piDesktopApi;

try {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<pre style="padding:16px;color:#f8caca;background:#241517;white-space:pre-wrap;">Bootstrap error:\n${String(error)}</pre>`;
  }

  throw error;
}
