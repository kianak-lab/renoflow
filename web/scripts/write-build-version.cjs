/**
 * Generates public/build-version.json and public/sw.js before `next build`.
 * Unique per deployment (Vercel) or per local build timestamp.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const templatePath = path.join(__dirname, "sw.template.js");
const outJson = path.join(publicDir, "build-version.json");
const outSw = path.join(publicDir, "sw.js");

const version =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.BUILD_VERSION ||
  `${Date.now()}-${process.pid}`;

const payload = {
  version: String(version),
  builtAt: new Date().toISOString(),
};

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 0)}\n`, "utf8");

let sw = fs.readFileSync(templatePath, "utf8");
sw = sw.replace(/__BUILD_VERSION__/g, () => JSON.stringify(String(version)));
fs.writeFileSync(outSw, sw, "utf8");

process.stdout.write(`[build-version] ${payload.version}\n`);
