/**
 * Copies repo-root ../final.html into the Next app so it can be bundled with the /final route.
 * - web/src/app/final/final.html — included in the serverless trace (read at runtime)
 * - web/public/final.html — optional copy for local tooling / static serving
 */
const fs = require("fs");
const path = require("path");

const webRoot = path.join(__dirname, "..");
const src = path.join(webRoot, "..", "final.html");
const destDirPublic = path.join(webRoot, "public");
const destPublic = path.join(destDirPublic, "final.html");
const destDirRoute = path.join(webRoot, "src", "app", "final");
const destRoute = path.join(destDirRoute, "final.html");

function main() {
  if (!fs.existsSync(src)) {
    if (fs.existsSync(destRoute) || fs.existsSync(destPublic)) {
      console.warn(
        "[sync-final-html] ../final.html missing; using existing copies under src/app/final or public.",
      );
      return;
    }
    console.warn(
      "[sync-final-html] No final.html found — add ../final.html from repo root or place src/app/final/final.html.",
    );
    return;
  }
  fs.mkdirSync(destDirPublic, { recursive: true });
  fs.mkdirSync(destDirRoute, { recursive: true });
  fs.copyFileSync(src, destPublic);
  fs.copyFileSync(src, destRoute);
  console.log("[sync-final-html] Copied ../final.html -> public/final.html and src/app/final/final.html");
}

main();
