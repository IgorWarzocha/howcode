import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createViewImageTool,
  parseViewImageParams,
  supportsOriginalImageDetail,
} from "./view-image-tool.cts";

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

async function createImageFixture() {
  const cwd = await mkdtemp(join(tmpdir(), "howcode-view-image-tool-"));
  await writeFile(join(cwd, "image.png"), Buffer.from(pngBase64, "base64"));
  return cwd;
}

function createReader(label: string, calls: string[]) {
  return {
    async execute() {
      calls.push(label);
      return {
        content: [
          { type: "text" as const, text: `${label} metadata` },
          { type: "image" as const, data: pngBase64, mimeType: "image/png" },
        ],
        details: { label },
      };
    },
  };
}

describe("view_image tool", () => {
  it("normalizes file_path and image_path aliases", () => {
    const tool = createViewImageTool({ allowOriginalDetail: true });

    expect(tool.prepareArguments?.({ file_path: "first.png" })).toMatchObject({
      file_path: "first.png",
      path: "first.png",
    });
    expect(tool.prepareArguments?.({ image_path: "second.png" })).toMatchObject({
      image_path: "second.png",
      path: "second.png",
    });
  });

  it("renders alias paths during partial tool-call display", () => {
    const tool = createViewImageTool({ allowOriginalDetail: true });
    const theme = {
      bold: (text: string) => text,
      fg: (_name: string, text: string) => text,
    };

    const rendered = tool.renderCall?.({ file_path: "alias.png" }, theme as never, {} as never);

    expect(rendered).toMatchObject({ text: "view_image alias.png" });
  });

  it("rejects invalid detail values", () => {
    expect(() => parseViewImageParams({ path: "image.png", detail: "low" })).toThrow(
      /view_image\.detail only supports `original`/,
    );
    expect(() => parseViewImageParams({ path: "image.png", detail: 1 })).toThrow(
      /view_image\.detail must be a string/,
    );
  });

  it("rejects unsupported models before reading images", async () => {
    const cwd = await createImageFixture();
    const calls: string[] = [];
    const tool = createViewImageTool({
      createReaders: () => ({
        resized: createReader("resized", calls),
        original: createReader("original", calls),
      }),
    });

    await expect(
      tool.execute("call", { path: "image.png" }, undefined, undefined, {
        cwd,
        model: { input: ["text"] },
      } as never),
    ).rejects.toThrow(/view_image is not allowed/);
    expect(calls).toEqual([]);
  });

  it("rejects directories and non-image read results", async () => {
    const cwd = await createImageFixture();
    await mkdir(join(cwd, "screenshots"));
    const tool = createViewImageTool({
      createReaders: () => ({
        resized: {
          async execute() {
            return { content: [{ type: "text" as const, text: "not an image" }], details: {} };
          },
        },
        original: createReader("original", []),
      }),
    });

    await expect(
      tool.execute("call", { path: "screenshots" }, undefined, undefined, {
        cwd,
        model: { input: ["image"] },
      } as never),
    ).rejects.toThrow(/is not a file/);
    await expect(
      tool.execute("call", { path: "image.png" }, undefined, undefined, {
        cwd,
        model: { input: ["image"] },
      } as never),
    ).rejects.toThrow(/expected an image file/);
  });

  it("selects resized or original readers with model capability gating", async () => {
    const cwd = await createImageFixture();
    const calls: string[] = [];
    const tool = createViewImageTool({
      allowOriginalDetail: true,
      createReaders: () => ({
        resized: createReader("resized", calls),
        original: createReader("original", calls),
      }),
    });

    const resized = await tool.execute("call", { path: "image.png" }, undefined, undefined, {
      cwd,
      model: { input: ["image"] },
    } as never);
    expect(calls).toEqual(["resized"]);
    expect(resized.content.map((item) => item.type)).toEqual(["text", "image"]);

    await expect(
      tool.execute("call", { path: "image.png", detail: "original" }, undefined, undefined, {
        cwd,
        model: { input: ["image"], provider: "generic", id: "vision" },
      } as never),
    ).rejects.toThrow(/detail is not available/);

    const original = await tool.execute(
      "call",
      { path: "image.png", detail: "original" },
      undefined,
      undefined,
      { cwd, model: { input: ["image"], provider: "openai-codex", id: "codex" } } as never,
    );
    expect(calls).toEqual(["resized", "original"]);
    expect(original.content.map((item) => item.type)).toEqual(["text", "image"]);
  });

  it("detects original image detail support narrowly", () => {
    expect(
      supportsOriginalImageDetail({ input: ["image"], provider: "openai-codex" } as never),
    ).toBe(true);
    expect(supportsOriginalImageDetail({ input: ["image"], provider: "generic" } as never)).toBe(
      false,
    );
  });
});
