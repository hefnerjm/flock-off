#!/usr/bin/env node
// Precomputes a supercluster index tree from the raw national camera
// GeoJSON so the map never has to cluster 100k+ raw points in the browser.
// The client loads this file and calls Supercluster.getClusters(bbox, zoom)
// against the already-built tree — a lookup, not a computation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Supercluster from "supercluster";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const geoDir = path.join(root, "data/geo/cameras");

function main() {
  const rawPath = path.join(geoDir, "national.raw.geojson");
  if (!fs.existsSync(rawPath)) {
    console.error(`${path.relative(root, rawPath)} not found — run scripts/overpass-fetch.mjs first.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

  const index = new Supercluster({
    radius: 60,
    maxZoom: 14,
    minZoom: 0,
  });
  index.load(raw.features);

  // Supercluster doesn't ship a JSON (de)serializer for its internal tree,
  // so we precompute clusters at fixed zoom levels and store those as
  // static per-zoom feature collections; the client picks the nearest
  // precomputed level and renders it directly (zero client-side clustering).
  //
  // Capped at zoom 8: past that, clusters approach individual points and
  // the file balloons (measured: z0-8 combined ~1.4MB, but z10 alone is
  // ~4.5MB and z12 ~13MB, since there's little left to aggregate at that
  // scale over 100k+ points). The "National" preset is a country-wide
  // overview by design — the Bexar/Texas presets are where users see exact,
  // individual cameras. Revisit only if product wants deep-zoom on the
  // national map (would need real viewport tiling, not more static levels).
  const zoomLevels = [0, 2, 4, 6, 8];
  const worldBBox = [-170, 14.5, -65, 72];

  const byZoom = {};
  for (const zoom of zoomLevels) {
    byZoom[zoom] = index.getClusters(worldBBox, zoom);
  }

  fs.writeFileSync(
    path.join(geoDir, "national.clusters.json"),
    JSON.stringify({ zoomLevels, byZoom }, null, 2)
  );

  console.log(
    `Wrote national.clusters.json (${zoomLevels.length} precomputed zoom levels from ${raw.features.length} raw points)`
  );
}

main();
