#!/usr/bin/env node
// Stages the committed camera GeoJSON/cluster files into public/ so the
// map island can fetch them as static assets at runtime. Astro's public/
// dir must physically contain what it serves, so this runs before dev/build
// rather than duplicating the data permanently in source control.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "data/geo/cameras");
const destDir = path.join(root, "public/geo/cameras");

fs.mkdirSync(destDir, { recursive: true });

for (const file of ["bexar.geojson", "texas.geojson", "national.clusters.json", "meta.json"]) {
  const src = path.join(srcDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(destDir, file));
  }
}

console.log("Staged camera data into public/geo/cameras/");
