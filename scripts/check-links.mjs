#!/usr/bin/env node
// Checks that every source/link URL in data/abuse-cases and data/legal-cases
// is reachable. Two modes:
//   node scripts/check-links.mjs              -> checks every URL
//   node scripts/check-links.mjs --changed-only -> only URLs added/changed
//                                                    vs the PR base branch
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { globby } from "globby";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const CONCURRENCY = 5;

const sourceFields = {
  "abuse-cases": "sources",
  "legal-cases": "links",
};

function changedFiles() {
  const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "HEAD~1";
  try {
    return execSync(`git diff --name-only ${base}...HEAD`, { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { method, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let res = await fetchWithTimeout(url, "HEAD");
      if (res.status === 405 || res.status === 403) {
        res = await fetchWithTimeout(url, "GET");
      }
      if (res.ok) return null;
      if (attempt === MAX_RETRIES) return `HTTP ${res.status}`;
    } catch (err) {
      if (attempt === MAX_RETRIES) return err.name === "AbortError" ? "timed out" : err.message;
    }
  }
  return "unreachable";
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const changedOnly = process.argv.includes("--changed-only");
  const changed = changedOnly ? new Set(changedFiles()) : null;

  const urlEntries = [];
  for (const [dir, field] of Object.entries(sourceFields)) {
    const files = await globby(`data/${dir}/*.json`, { cwd: root, absolute: true });
    for (const file of files) {
      const relFile = path.relative(root, file);
      if (changedOnly && !changed.has(relFile)) continue;
      const entry = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const item of entry[field] ?? []) {
        urlEntries.push({ file: relFile, url: item.url });
      }
    }
  }

  if (urlEntries.length === 0) {
    console.log(changedOnly ? "No changed data files with URLs to check." : "No URLs to check.");
    return;
  }

  const results = await mapWithConcurrency(urlEntries, CONCURRENCY, async ({ url }) => checkUrl(url));

  const failures = urlEntries
    .map((entry, i) => ({ ...entry, error: results[i] }))
    .filter((r) => r.error);

  if (failures.length > 0) {
    console.error(`${failures.length} dead/unreachable URL(s):\n`);
    for (const f of failures) console.error(`${f.file}: ${f.url} (${f.error})`);
    process.exitCode = 1;
    return;
  }

  console.log(`All ${urlEntries.length} source URL(s) reachable.`);
}

await main();
