/**
 * Copies repo-root ../final.html into web/public/final.html before `next build`.
 * Vercel Root Directory = `web` still clones the full repo, so ../final.html exists at build time.
 * Serverless bundles cannot reliably read paths outside the app root at runtime.
 */
const fs = require("fs");
const path = require("path");

const webRoot = path.join(__dirname, "..");
const src = path.join(webRoot, "..", "final.html");
const destDir = path.join(webRoot, "public");
const dest = path.join(destDir, "final.html");

function main() {
  if (!fs.existsSync(src)) {
    if (fs.existsSync(dest)) {
      console.warn(
        "[sync-final-html] ../final.html missing; using existing public/final.html",
      );
      return;
    }
    console.warn(
      "[sync-final-html] No final.html at ../final.html and no public/final.html — /final will 404 until you add one.",
    );
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("[sync-final-html] Copied ../final.html -> public/final.html");
}

main();
