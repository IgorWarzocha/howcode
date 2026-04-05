import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEV_SERVER_METADATA_RELATIVE_PATH,
  parseDevServerMetadata,
  resolveDevServerMetadataPath,
  resolveRepoRoot,
} from "../bun/dev-server";

describe("dev server helpers", () => {
  it("resolves the repo root from the bundled Electrobun resource path", () => {
    const bundledMainPath = path.join(
      process.cwd(),
      "build",
      "dev-linux-x64",
      "howcode-dev",
      "Resources",
      "main.js",
    );

    expect(resolveRepoRoot([bundledMainPath])).toBe(process.cwd());
    expect(resolveDevServerMetadataPath([bundledMainPath])).toBe(
      path.join(process.cwd(), DEV_SERVER_METADATA_RELATIVE_PATH),
    );
  });

  it("prefers an explicit repo root when one is provided", () => {
    expect(resolveDevServerMetadataPath([process.cwd()])).toBe(
      path.join(process.cwd(), DEV_SERVER_METADATA_RELATIVE_PATH),
    );
  });

  it("parses an explicit dev server url", () => {
    expect(parseDevServerMetadata('{"url":"http://127.0.0.1:5174"}')).toBe("http://127.0.0.1:5174");
  });

  it("builds a url from host and port metadata", () => {
    expect(parseDevServerMetadata('{"host":"127.0.0.1","port":5175}')).toBe(
      "http://127.0.0.1:5175",
    );
  });

  it("returns null for incomplete metadata", () => {
    expect(parseDevServerMetadata('{"host":"127.0.0.1"}')).toBeNull();
  });
});
