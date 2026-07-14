#!/usr/bin/env node
// Fetches ALPR camera locations from OpenStreetMap via the Overpass API and
// writes GeoJSON extracts for Bexar County, Texas, and a national bbox.
// Never fabricates coordinates: only nodes Overpass actually returns (with
// real lat/lon) are written, and duplicate OSM node ids are collapsed.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "data/geo/cameras");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const MAX_RETRIES_PER_MIRROR = 2;
const RETRY_BASE_DELAY_MS = 5000;
const REQUEST_TIMEOUT_MS = 180_000;

// ALPR nodes are tagged man_made=surveillance + surveillance:type=ALPR per
// the OSM wiki convention DeFlock.me uses; also match capture=license_plate
// for contributors who tag the capability directly instead/as well.
function buildQuery(areaClause) {
  return `
[out:json][timeout:170];
${areaClause}
(
  node["man_made"="surveillance"]["surveillance:type"~"ALPR"]${areaClause ? "(area.searchArea)" : ""};
  node["man_made"="surveillance"]["capture"="license_plate"]${areaClause ? "(area.searchArea)" : ""};
);
out body;
`.trim();
}

const REGIONS = {
  bexar: buildQuery(
    'area["name"="Bexar County"]["admin_level"="6"]["boundary"="administrative"]->.searchArea;'
  ),
  texas: buildQuery(
    'area["name"="Texas"]["admin_level"="4"]["boundary"="administrative"]->.searchArea;'
  ),
  // Continental US + AK/HI bbox, no area lookup (area queries are far slower
  // at country scale; a raw bbox is the standard approach for large extents).
  national: `
[out:json][timeout:170];
(
  node["man_made"="surveillance"]["surveillance:type"~"ALPR"](14.5,-170,72,-65);
  node["man_made"="surveillance"]["capture"="license_plate"](14.5,-170,72,-65);
);
out body;
`.trim(),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOverpass(ql) {
  let lastError;
  for (const mirror of MIRRORS) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MIRROR; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(mirror, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "flock-off-camera-map/1.0 (https://github.com/flock-off; weekly ALPR data refresh)",
          },
          body: `data=${encodeURIComponent(ql)}`,
          signal: controller.signal,
        });
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after"));
          lastError = new Error(`${mirror} rate-limited (429)`);
          clearTimeout(timer);
          if (attempt < MAX_RETRIES_PER_MIRROR) {
            await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : RETRY_BASE_DELAY_MS * 2 ** attempt);
          }
          continue;
        }
        clearTimeout(timer);
        if (!res.ok) {
          lastError = new Error(`${mirror} responded ${res.status}`);
        } else {
          const json = await res.json();
          if (!Array.isArray(json.elements)) {
            lastError = new Error(`${mirror} returned no elements array`);
          } else {
            return json.elements;
          }
        }
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
      }
      if (attempt < MAX_RETRIES_PER_MIRROR) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
    console.warn(`Mirror ${mirror} failed after retries: ${lastError?.message}`);
  }
  throw new Error(`All Overpass mirrors failed. Last error: ${lastError?.message}`);
}

function toGeoJSON(elements) {
  const seen = new Set();
  const features = [];
  for (const el of elements) {
    if (el.type !== "node") continue;
    if (typeof el.lat !== "number" || typeof el.lon !== "number") continue; // never fabricate
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    features.push({
      type: "Feature",
      id: el.id,
      geometry: { type: "Point", coordinates: [el.lon, el.lat] },
      properties: {
        osm_id: el.id,
        ...el.tags,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

async function fetchRegion(name, ql) {
  console.log(`Querying Overpass for ${name}...`);
  const elements = await queryOverpass(ql);
  const geojson = toGeoJSON(elements);
  console.log(`${name}: ${geojson.features.length} camera node(s)`);
  return geojson;
}

async function main() {
  await fsp.mkdir(outDir, { recursive: true });

  const results = {};
  // Sequential, not parallel: be polite to the shared public Overpass
  // instance and avoid tripping its fair-use rate limiting.
  for (const [name, ql] of Object.entries(REGIONS)) {
    results[name] = await fetchRegion(name, ql);
    await sleep(2000);
  }

  fs.writeFileSync(
    path.join(outDir, "bexar.geojson"),
    JSON.stringify(results.bexar, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "texas.geojson"),
    JSON.stringify(results.texas, null, 2)
  );
  // National is raw here; scripts/build-clusters.mjs turns this into a
  // precomputed supercluster tree for the map to consume.
  fs.writeFileSync(
    path.join(outDir, "national.raw.geojson"),
    JSON.stringify(results.national, null, 2)
  );

  fs.writeFileSync(
    path.join(outDir, "meta.json"),
    JSON.stringify(
      {
        lastUpdated: new Date().toISOString(),
        counts: {
          bexar: results.bexar.features.length,
          texas: results.texas.features.length,
          national: results.national.features.length,
        },
        source: "OpenStreetMap contributors, via Overpass API",
        license: "ODbL",
      },
      null,
      2
    )
  );

  console.log("Wrote data/geo/cameras/{bexar,texas,national.raw}.geojson + meta.json");
}

await main();
