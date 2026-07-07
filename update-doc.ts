// Copies the freshly built browser bundle into ./docs and points the demo page
// at the versioned filename. Run after `bun run build` via `bun run build:docs`.
import fs from "node:fs";
import pkg from "./package.json";

const fileName = "./docs/index.html";

// delete previous browser-<version>.js files
for (const file of fs.readdirSync("./docs/")) {
  if (/^browser-[\d.]+\.js$/.test(file)) fs.unlinkSync(`./docs/${file}`);
}

// copy the newly built bundle
fs.copyFileSync("./dist/browser.js", `./docs/browser-${pkg.version}.js`);

// update the demo HTML to reference it
const html = fs
  .readFileSync(fileName, "utf8")
  .replace(/browser-[\d.]+\.js/, `browser-${pkg.version}.js`);
fs.writeFileSync(fileName, html);

console.log("Documentation updated with last version");
