import { readFile } from "node:fs/promises";
import { Updater } from "electrobun/bun";
import { parseDevServerMetadata, resolveDevServerMetadataPath } from "./dev-server";

export async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    const devServerMetadataPath = resolveDevServerMetadataPath([
      process.env.HOWCODE_REPO_ROOT ?? "",
      import.meta.dir,
      process.cwd(),
    ]);

    if (!devServerMetadataPath) {
      console.warn("Falling back to packaged views because the repo root could not be resolved.", {
        moduleDirectoryPath: import.meta.dir,
        processCwd: process.cwd(),
      });
      return "views://mainview/index.html";
    }

    try {
      const rawMetadata = await readFile(devServerMetadataPath, "utf8");
      const devServerUrl = parseDevServerMetadata(rawMetadata);

      if (devServerUrl) {
        await fetch(devServerUrl, { method: "HEAD" });
        return devServerUrl;
      }
    } catch (error) {
      console.warn(
        "Falling back to packaged views because the dev server metadata was unavailable.",
        {
          devServerMetadataPath,
          error,
        },
      );
    }
  }

  return "views://mainview/index.html";
}
