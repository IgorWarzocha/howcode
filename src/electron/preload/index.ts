import { contextBridge } from "electron";
import { createDesktopApi } from "./create-desktop-api";

contextBridge.exposeInMainWorld("piDesktop", createDesktopApi());
