const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", ".next");
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("[clean-next] removed .next");
} catch (e) {
  if (e && e.code !== "ENOENT") throw e;
}
