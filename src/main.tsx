import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "@fontsource-variable/inter";
import "./styles.css";
import App from "./App";
import { piDesktopApi } from "./app/desktop/electrobun-api";
import { queryClient } from "./app/query/query-client";

window.piDesktop = piDesktopApi;

try {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
} catch (error) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<pre class="bootstrap-error">Bootstrap error:\n${String(error)}</pre>`;
  }

  throw error;
}
