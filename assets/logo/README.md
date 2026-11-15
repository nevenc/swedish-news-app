# Swedlines logo

- `mark.svg` — the mark alone (favicon, app icon, social avatar). Pure geometry, no fonts.
- `png/mark-<size>.png` — the mark rasterized at 16, 32, 48, 64, 96, 128, 180, 192, 256, 512 and 1024 px. Regenerate with `npm run logo` after editing `mark.svg`.
- `favicon.ico` — 16/32/48 px, also produced by `npm run logo`.
- `lockup.svg` — mark plus wordmark. The wordmark is live text in Manrope ExtraBold; convert to outlines before sending to print or anywhere Manrope is not loaded.

Colors: blue `#006AA7` (Pantone 301), yellow `#FECC02` (Pantone 116). Single-color version: bars in blue on transparent, or white bars on near-black.

The wordmark font (Manrope, SIL OFL) is bundled in `assets/fonts/manrope/` so `npm run cover` renders it as outlines on any machine.
