/**
 * Bundles MaterialSearch for embedding in final.html (shop / materials list).
 * Output: public/rf-material-search.js (ESM, loaded via dynamic import)
 */
const esbuild = require("esbuild");
const path = require("path");

async function main() {
  const webRoot = path.join(__dirname, "..");
  const entry = path.join(webRoot, "src/entry/rf-material-search-mount.tsx");
  const outfile = path.join(webRoot, "public/rf-material-search.js");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    minify: true,
    sourcemap: false,
    logLevel: "info",
  });
  console.log("[bundle-rf-material-search] wrote", outfile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
