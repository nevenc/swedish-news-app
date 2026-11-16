/**
 * Social images, rendered at 1x and 2x. Run: npm run cover
 *   assets/social/ko-fi-cover-1200x400.png  Ko-fi page cover (3:1)
 *   assets/social/og-1200x630.png           Open Graph preview, copied to the site as assets/og.png
 *   assets/social/og-sv-1200x630.png        Swedish version, copied to the site as assets/og-sv.png (About page)
 *
 * Text is converted to outlines from the bundled Manrope variable font (assets/fonts/manrope,
 * SIL OFL) with fontkit, so the render is identical on every machine and needs no installed fonts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as fontkit from "fontkit";
import sharp from "sharp";

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

// Faint "headline stream": rows of bars of varying width, placed to the right of the text.
function stream(x0: number, y0: number, rows: number): string {
  const widths = [170, 120, 200, 100, 150, 190, 110, 160, 140, 200, 105, 180, 150, 125, 190, 140, 170, 110];
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * 31;
    const x = x0 + ((i * 37) % 50);
    out.push(`<rect x="${x}" y="${y}" width="${widths[i % widths.length]}" height="10" rx="5" fill="#fff" fill-opacity="0.07"/>`);
  }
  return out.join("");
}

/** The mark's three bars, enlarged (tile omitted: the background is already the tile blue). */
function bars(x: number, y: number, s: number): string {
  return [
    [0, 0, 180],
    [0, 55, 130],
    [0, 110, 90],
  ]
    .map(([dx, dy, w]) => `<rect x="${x + dx * s}" y="${y + dy * s}" width="${w * s}" height="${40 * s}" rx="${20 * s}" fill="${YELLOW}"/>`)
    .join("");
}

async function renderPng(svg: string, w: number, h: number, base: string, outDir: string): Promise<void> {
  const big = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(outDir, `${base}-${w * 2}x${h * 2}.png`), big);
  const small = await sharp(big).resize(w, h).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(outDir, `${base}-${w}x${h}.png`), small);
  console.log(`${base}-${w}x${h}.png ${small.length} bytes; ${base}-${w * 2}x${h * 2}.png ${big.length} bytes`);
}

const outDir = join(process.cwd(), "assets", "social");
await mkdir(outDir, { recursive: true });

// 1. Ko-fi cover, 3:1
{
  const W = 1200;
  const H = 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">
  <rect width="${W}" height="${H}" fill="${BLUE}"/>
  ${stream(950, 28, 12)}
  ${bars(128, 112, 1)}
  ${outlines("swedlines", { x: 372, y: 208, size: 104, wght: 800, tracking: -4, fill: "#fff" })}
  ${outlines("Swedish news headlines, in Swedish and English", { x: 378, y: 262, size: 30, wght: 600, fill: YELLOW })}
  ${outlines("Updated every 15 minutes · swedlines.com", { x: 378, y: 304, size: 26, wght: 600, fill: "#fff", opacity: 0.8 })}
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${YELLOW}"/>
</svg>`;
  await renderPng(svg, W, H, "ko-fi-cover", outDir);
}

// 2. Open Graph / social preview, 1200x630, English (site assets/og.png) and Swedish (assets/og-sv.png, About page)
const OG_COPY = {
  og: {
    h1: "Swedish news.",
    h2: "In English and Swedish.",
    lede: "Headlines from leading Swedish publishers, together in one place.",
  },
  "og-sv": {
    h1: "Svenska nyheter.",
    h2: "På engelska och svenska.",
    lede: "Rubriker från ledande svenska publicister, samlade på ett ställe.",
  },
};
for (const [base, copy] of Object.entries(OG_COPY)) {
  const W = 1200;
  const H = 630;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">
  <rect width="${W}" height="${H}" fill="${BLUE}"/>
  ${stream(960, 40, 18)}
  ${bars(100, 96, 0.7)}
  ${outlines("swedlines", { x: 270, y: 180, size: 84, wght: 800, tracking: -3, fill: "#fff" })}
  ${outlines(copy.h1, { x: 100, y: 330, size: 64, wght: 800, tracking: -2, fill: "#fff" })}
  ${outlines(copy.h2, { x: 100, y: 404, size: 64, wght: 800, tracking: -2, fill: YELLOW })}
  ${outlines(copy.lede, { x: 100, y: 470, size: 28, wght: 600, fill: "#fff", opacity: 0.85 })}
  ${outlines("swedlines.com", { x: 100, y: 548, size: 26, wght: 600, fill: "#fff", opacity: 0.7 })}
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${YELLOW}"/>
</svg>`;
  await renderPng(svg, W, H, base, outDir);
}
