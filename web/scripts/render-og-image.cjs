/**
 * Rasterizes repo-root `renoflow image.svg` to `public/og-image.png` for Open
 * Graph (PNG is widely supported vs SVG). Edit the SVG in the repo root, then
 * run `npm run og:render` (also runs on `npm run build`).
 */
const path = require("path");
const sharp = require("sharp");

const webRoot = path.join(__dirname, "..");
const repoRoot = path.join(webRoot, "..");
const input = path.join(repoRoot, "renoflow image.svg");
const output = path.join(webRoot, "public", "og-image.png");

sharp(input)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .png()
  .toFile(output)
  .then(() => {
    console.log("[render-og-image] Wrote", output);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
