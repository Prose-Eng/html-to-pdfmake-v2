// Copies the freshly built browser bundle into ./docs and points the demo page
// at the versioned filename. Run after `bun run build` via `bun run build:docs`.
import fs from "node:fs";
import pkg from "./package.json";

const fileName = "./docs/index.html";

// delete previous browser-<version>.js files
for (const file of fs.readdirSync("./docs/")) {
  if (/^browser-[\d.]+\.js$/.test(file)) fs.unlinkSync(`./docs/${file}`);
}

// copy the newly built bundle, prefixed with a "generated" banner
const banner = `// GENERATED FILE - do not edit. Built by \`bun run build:docs\` from dist/browser.js (@prose-eng/html-to-pdfmake v${pkg.version}).\n`;
const bundle = fs.readFileSync("./dist/browser.js", "utf8");
fs.writeFileSync(`./docs/browser-${pkg.version}.js`, banner + bundle);

// update the demo HTML to reference it
const html = fs
  .readFileSync(fileName, "utf8")
  .replace(/browser-[\d.]+\.js/, `browser-${pkg.version}.js`);
fs.writeFileSync(fileName, html);

console.log("Documentation updated with last version");
