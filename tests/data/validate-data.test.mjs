import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAll } from "../../scripts/validate-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("valid fixtures pass validation with no errors", async () => {
  const failures = await validateAll(path.join(__dirname, "fixtures/valid"));
  assert.deepEqual(failures, []);
});

test("invalid fixtures are all rejected", async () => {
  const failures = await validateAll(path.join(__dirname, "fixtures/invalid"));
  const files = failures.map((f) => f.file);
  assert.ok(files.includes(path.join("data/abuse-cases", "no-sources.json")));
  assert.ok(files.includes(path.join("data/abuse-cases", "mismatched-id.json")));
  assert.ok(files.includes(path.join("data/legal-cases", "missing-fields.json")));
});
