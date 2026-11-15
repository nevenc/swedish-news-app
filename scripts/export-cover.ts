/**
 * Ko-fi / social cover: 1200x400 (3:1), rendered at 2x as well. Run: npm run cover
 * Wordmark uses Avenir Next (macOS) as a stand-in for Manrope when Manrope is not installed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const W = 1200;
const H = 400;
const BLUE = "#006AA7";
const YELLOW = "#FECC02";
const FONT = "Manrope, 'Avenir Next', 'Helvetica Neue', Arial, sans-serif";

// Faint "headline stream" in the background: rows of bars of varying width.
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
  <text x="372" y="208" font-family="${FONT}" font-weight="800" font-size="104" letter-spacing="-4" fill="#fff">swedlines</text>
  <text x="378" y="262" font-family="${FONT}" font-weight="600" font-size="30" fill="${YELLOW}">Swedish news headlines, in Swedish and English</text>
  <text x="378" y="304" font-family="${FONT}" font-weight="600" font-size="26" fill="#fff" fill-opacity="0.8">Updated every 15 minutes · swedlines.com</text>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${YELLOW}"/>
</svg>`;

const outDir = join(process.cwd(), "assets", "social");
await mkdir(outDir, { recursive: true });
const big = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(join(outDir, "ko-fi-cover-2400x800.png"), big);
const small = await sharp(big).resize(W, H).png({ compressionLevel: 9 }).toBuffer();
await writeFile(join(outDir, "ko-fi-cover-1200x400.png"), small);
console.log(`ko-fi-cover-2400x800.png ${big.length} bytes; ko-fi-cover-1200x400.png ${small.length} bytes`);
