/**
 * Build script. Emits, into ./dist:
 *   - index.mjs   ESM bundle
 *   - index.cjs   CommonJS bundle (require() returns the function directly)
 *   - browser.mjs browser-targeted ESM bundle with the public named exports
 *   - browser.js  minified IIFE that sets the global `htmlToPdfmake`
 *   - index.d.ts  TypeScript declarations (via tsc)
 *
 * Run with: bun run build
 */
import { rm } from "node:fs/promises";
import { $ } from "bun";

const outdir = "dist";

async function build(options: Parameters<typeof Bun.build>[0]) {
  const result = await Bun.build(options);
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Bun.build failed for ${String(options.entrypoints)}`);
  }
  return result;
}

await rm(outdir, { recursive: true, force: true });

// ESM
await build({
  entrypoints: ["src/index.ts"],
  outdir,
  target: "node",
  format: "esm",
  naming: "index.mjs",
});
// Browser ESM. Bundlers select this through the package's `browser` export
// condition, so it must expose the same public API as the Node ESM bundle.
await build({
  entrypoints: ["src/index.ts"],
  outdir,
  target: "browser",
  format: "esm",
  naming: "browser.mjs",
});

// CommonJS. Bun emits `module.exports = { default, htmlToPdfmake }`; flatten it so
// `require(pkg)` returns the callable itself (not the namespace object) while
// still exposing the named/`.default` properties.
await build({
  entrypoints: ["src/index.ts"],
  outdir,
  target: "node",
  format: "cjs",
  naming: "index.cjs",
});
const cjsPath = `${outdir}/index.cjs`;
const cjs = await Bun.file(cjsPath).text();
const interop = `
// interop: make require() return the default function directly
if (module.exports && module.exports.default) {
  module.exports = Object.assign(module.exports.default, module.exports);
}
`;
await Bun.write(cjsPath, cjs + interop);

// Browser IIFE (global \`htmlToPdfmake\`)
await build({
  entrypoints: ["src/browser.ts"],
  outdir,
  target: "browser",
  format: "iife",
  naming: "browser.js",
  minify: true,
});

// Type declarations
await $`tsc -p tsconfig.build.json`;

const browserModule = (await import(`./${outdir}/browser.mjs?build=${Date.now()}`)) as Record<
  string,
  unknown
>;
for (const exportName of ["default", "htmlToPdfmake", "convertDocument"]) {
  if (typeof browserModule[exportName] !== "function") {
    throw new Error(`Browser ESM bundle is missing the ${exportName} function export`);
  }
}

console.log("Build complete -> dist/{index.mjs,index.cjs,browser.mjs,browser.js,index.d.ts}");
