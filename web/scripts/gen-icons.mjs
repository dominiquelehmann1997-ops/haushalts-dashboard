// Renders the teal house icon (public/icon.svg) into the PNG sizes that
// iOS/Android home-screen install needs. Flatten onto solid teal so there are
// no transparent corners (iOS apple-touch and maskable both want full-bleed).
// Run-once: `npm run gen:icons`. The PNGs are committed.
import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");
const src = join(pub, "icon.svg");
const TEAL = "#0f766e";

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-512-maskable.png", size: 512 },
  { name: "apple-icon-180.png", size: 180 },
];

for (const { name, size } of targets) {
  await sharp(src)
    .resize(size, size)
    .flatten({ background: TEAL })
    .png()
    .toFile(join(pub, name));
  console.log("wrote", name);
}
