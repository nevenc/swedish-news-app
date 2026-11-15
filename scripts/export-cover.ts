/**
 * Ko-fi / social cover: 1200x400 (3:1), rendered at 1x and 2x. Run: npm run cover
 *
 * Text is converted to outlines from the bundled Manrope variable font (assets/fonts/manrope,
 * SIL OFL) with fontkit, so the render is identical on every machine and needs no installed fonts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as fontkit from "fontkit";
import sharp from "sharp";

const W = 1200;
const H = 400;
const BLUE = "#006AA7";
const YELLOW = "#FECC02";

const manrope = fontkit.openSync(join(process.cwd(), "assets", "fonts", "manrope", "Manrope[wght].ttf"));
if (!("getVariation" in manrope)) throw new Error("expected a single font, not a collection");

/** Lay out `text` with Manrope at the given weight and return SVG <path> outlines at (x, baselineY). */
function outlines(
  text: string,
  o: { x: number; y: number; size: number; wght: number; tracking?: number; fill: string; opacity?: number },
): string {
  const font = manrope.getVariation({ wght: o.wght });
  const run = font.layout(text);
  const s = o.size / font.unitsPerEm;
  let x = o.x;
  const parts: string[] = [];
  run.glyphs.forEach((g, i) => {
    const p = run.positions[i];
    if (!p) return;
    const d = g.path.toSVG();
    if (d) {
      parts.push(
        `<path d="${d}" transform="translate(${(x + p.xOffset * s).toFixed(2)} ${(o.y - p.yOffset * s).toFixed(2)}) scale(${s.toFixed(5)} ${(-s).toFixed(5)})"/>`,
      );
    }
    x += p.xAdvance * s + (o.tracking ?? 0);
  });
  const opacity = o.opacity === undefined ? "" : ` fill-opacity="${o.opacity}"`;
  return `<g fill="${o.fill}"${opacity}>${parts.join("")}</g>`;
}

// Faint "headline stream" on the right: rows of bars of varying width.
const rows: string[] = [];
const widths = [170, 120, 200, 100, 150, 190, 110, 160, 140, 200, 105, 180];
for (let i = 0; i < 12; i++) {
  const y = 28 + i * 31;
  const x = 950 + ((i * 37) % 50);
  rows.push(
    `<rect x="${x}" y="${y}" width="${widths[i]}" height="10" rx="5" fill="#fff" fill-opacity="0.07"/>`,
  );
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">
  <rect width="${W}" height="${H}" fill="${BLUE}"/>
  <g>${rows.join("")}</g>
  <!-- the mark's three bars, enlarged (tile omitted: background is already the tile blue) -->
  <rect x="128" y="112" width="180" height="40" rx="20" fill="${YELLOW}"/>
  <rect x="128" y="167" width="130" height="40" rx="20" fill="${YELLOW}"/>
  <rect x="128" y="222" width="90" height="40" rx="20" fill="${YELLOW}"/>
  ${outlines("swedlines", { x: 372, y: 208, size: 104, wght: 800, tracking: -4, fill: "#fff" })}
  ${outlines("Swedish news headlines, in Swedish and English", { x: 378, y: 262, size: 30, wght: 600, fill: YELLOW })}
  ${outlines("Updated every 15 minutes · swedlines.com", { x: 378, y: 304, size: 26, wght: 600, fill: "#fff", opacity: 0.8 })}
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${YELLOW}"/>
</svg>`;

const outDir = join(process.cwd(), "assets", "social");
await mkdir(outDir, { recursive: true });
const big = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(join(outDir, "ko-fi-cover-2400x800.png"), big);
const small = await sharp(big).resize(W, H).png({ compressionLevel: 9 }).toBuffer();
await writeFile(join(outDir, "ko-fi-cover-1200x400.png"), small);
console.log(`ko-fi-cover-2400x800.png ${big.length} bytes; ko-fi-cover-1200x400.png ${small.length} bytes`);
