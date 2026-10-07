// Fails if a production build contains mock data or mock-only code.
// docs/decisions/2026-10-06-frontend-mocks-msw.md: mocks never ship in production.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? ".next/static";
// Markers that only exist in src/mocks/ and its fixtures.
const MARKERS = ["del_glow_video", "synthetic-draft-", "simulateUpload", "mockServiceWorker", "setupWorker("];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|css|html|json)$/.test(name)) yield path;
  }
}

const hits = [];
for (const file of files(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const marker of MARKERS) if (text.includes(marker)) hits.push(`${file}: ${marker}`);
}

if (hits.length) {
  console.error(`Mock data found in the production build:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`No mock data in ${ROOT}.`);
