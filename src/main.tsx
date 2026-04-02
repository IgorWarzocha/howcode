import React from "react";
import ReactDOM from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "@fontsource-variable/inter";
import App from "./App";
import { piDesktopApi } from "./app/desktop/electrobun-api";
import "./styles.css";

window.piDesktop = piDesktopApi;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
