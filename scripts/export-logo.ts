/**
 * Rasterize the logo mark into the PNG sizes the site, app stores and social
 * networks expect, plus a multi-size favicon.ico. Run: npm run logo
 *
 * Output: assets/logo/png/mark-<size>.png and assets/logo/favicon.ico.
 * The lockup (wordmark) is not rasterized here because it needs the Manrope font installed.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512, 1024];
const ICO_SIZES = [16, 32, 48];

const root = process.cwd();
const svg = await readFile(join(root, "assets", "logo", "mark.svg"));
const outDir = join(root, "assets", "logo", "png");
await mkdir(outDir, { recursive: true });

const pngs = new Map<number, Buffer>();
for (const size of SIZES) {
  const png = await sharp(svg, { density: Math.ceil((72 * size) / 64) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  pngs.set(size, png);
  await writeFile(join(outDir, `mark-${size}.png`), png);
  console.log(`mark-${size}.png  ${png.length} bytes`);
}

/** ICO container holding PNG-encoded images (supported by every browser since IE9/Vista). */
function packIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, png }, i) => {
    const e = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, e); // width
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.png)]);
}

const ico = packIco(
  ICO_SIZES.map((size) => {
    const png = pngs.get(size);
    if (!png) throw new Error(`missing ${size}px PNG for favicon`);
    return { size, png };
  }),
);
await writeFile(join(root, "assets", "logo", "favicon.ico"), ico);
console.log(`favicon.ico  ${ico.length} bytes (${ICO_SIZES.join("/")} px)`);
