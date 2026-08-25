import { describe, expect, it } from "vitest";

import {
  contentTypeForImage,
  imageFileName,
  isSafeImageFile,
  MAX_IMAGE_BYTES,
  readCapped,
  sniffImageExtension,
} from "./recipeImage";

/** Baut Bytes aus einer Mischung aus Zahlen und ASCII-Text. */
function bytes(...parts: (number | string)[]): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "number") out.push(part);
    else for (const char of part) out.push(char.charCodeAt(0));
  }
  const buffer = new ArrayBuffer(out.length);
  const view = new Uint8Array(buffer);
  view.set(out);
  return view;
}

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, "JFIF");
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);

describe("sniffImageExtension", () => {
  it("erkennt die unterstützten Formate an den ersten Bytes", () => {
    expect(sniffImageExtension(JPEG)).toBe("jpg");
    expect(sniffImageExtension(PNG)).toBe("png");
    expect(sniffImageExtension(bytes("GIF89a", 0x01))).toBe("gif");
    expect(sniffImageExtension(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe("webp");
    expect(sniffImageExtension(bytes(0, 0, 0, 0x20, "ftypavif"))).toBe("avif");
  });

  it("weist alles zurück, was kein Bild ist", () => {
    // Der reale Fall: die Seite antwortet mit 200 und einer HTML-Fehlerseite.
    expect(sniffImageExtension(bytes("<!DOCTYPE html><html>"))).toBeNull();
    expect(sniffImageExtension(bytes(0xff, 0xd8))).toBeNull(); // abgeschnittenes JPEG
    expect(sniffImageExtension(new Uint8Array())).toBeNull();
  });

  it("verlangt bei RIFF auch die WEBP-Marke", () => {
    // RIFF ist auch der Container von .wav — die Marke entscheidet.
    expect(sniffImageExtension(bytes("RIFF", 0, 0, 0, 0, "WAVEfmt "))).toBeNull();
  });
});

describe("isSafeImageFile", () => {
  it("lässt die Namen durch, die der Downloader vergibt", () => {
    expect(isSafeImageFile("gemuese-curry.jpg")).toBe(true);
    expect(isSafeImageFile("cmt8lwajf000xm0v7ap8yh9pt.webp")).toBe(true);
  });

  it("wehrt Path-Traversal und Pfadtrenner ab", () => {
    expect(isSafeImageFile("../../.env")).toBe(false);
    expect(isSafeImageFile("..%2f.env")).toBe(false);
    expect(isSafeImageFile("unter/curry.jpg")).toBe(false);
    expect(isSafeImageFile("C:\\Windows\\win.ini")).toBe(false);
    expect(isSafeImageFile(".hidden.jpg")).toBe(false);
  });

  it("lässt nur Bildendungen durch", () => {
    expect(isSafeImageFile("curry.js")).toBe(false);
    expect(isSafeImageFile("curry")).toBe(false);
    expect(isSafeImageFile("curry.jpg.js")).toBe(false);
    // Großschreibung kommt nie aus `imageFileName` — also auch nicht rein.
    expect(isSafeImageFile("Curry.JPG")).toBe(false);
  });
});

describe("imageFileName", () => {
  it("setzt Slug und Endung zusammen", () => {
    expect(imageFileName("gemuese-curry", "jpg")).toBe("gemuese-curry.jpg");
  });

  it("liefert null, statt einen unsicheren Namen zu bauen", () => {
    expect(imageFileName("../etc/passwd", "jpg")).toBeNull();
    expect(imageFileName("", "jpg")).toBeNull();
  });
});

describe("contentTypeForImage", () => {
  it("bildet Endung auf MIME-Typ ab", () => {
    expect(contentTypeForImage("curry.jpg")).toBe("image/jpeg");
    expect(contentTypeForImage("curry.webp")).toBe("image/webp");
  });

  it("liefert null für alles andere", () => {
    expect(contentTypeForImage("curry.svg")).toBeNull();
    expect(contentTypeForImage("curry")).toBeNull();
  });
});

describe("readCapped", () => {
  it("liest den Body vollständig", async () => {
    const read = await readCapped(new Response(PNG));
    expect(read).toEqual(PNG);
  });

  it("setzt mehrteilige Antworten wieder zusammen", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes(0x89, 0x50));
        controller.enqueue(bytes(0x4e, 0x47));
        controller.close();
      },
    });
    expect(await readCapped(new Response(stream))).toEqual(bytes(0x89, 0x50, 0x4e, 0x47));
  });

  it("bricht bei zu großen Bildern ab, statt sie ganz einzulesen", async () => {
    expect(await readCapped(new Response(new Uint8Array(50)), 10)).toBeNull();
  });

  it("nimmt eine Antwort genau an der Grenze noch an", async () => {
    const read = await readCapped(new Response(new Uint8Array(10)), 10);
    expect(read).toHaveLength(10);
  });

  it("verträgt eine Antwort ohne Body", async () => {
    expect(await readCapped(new Response(null, { status: 204 }))).toBeNull();
  });

  it("hat eine Obergrenze, die für Titelbilder reicht", () => {
    expect(MAX_IMAGE_BYTES).toBeGreaterThanOrEqual(1024 * 1024);
  });
});
