const fs = require("fs");
const path = require("path");

const cache = path.join(__dirname, "..", ".next", "cache");
try {
  fs.rmSync(cache, { recursive: true, force: true });
  console.log("[clean-next-cache] removed .next/cache");
} catch (e) {
  if (e && e.code !== "ENOENT") throw e;
}
