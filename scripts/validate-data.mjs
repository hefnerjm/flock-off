#!/usr/bin/env node
// Validates every file in <root>/data/abuse-cases and <root>/data/legal-cases
// against its JSON Schema, plus business rules JSON Schema can't fully
// express (e.g. "id must match filename"). Reports every failure found
// across all files, rather than stopping at the first one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { globby } from "globby";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const sourceFields = {
  "abuse-cases": "sources",
  "legal-cases": "links",
};

export async function validateAll(root = projectRoot) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  function loadSchema(name) {
    const schemaPath = path.join(root, "data/schemas", `${name}.schema.json`);
    return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, "utf8")));
  }

  const validators = {
    "abuse-cases": loadSchema("abuse-case"),
    "legal-cases": loadSchema("legal-case"),
  };

  const failures = [];

  for (const [dir, validate] of Object.entries(validators)) {
    const files = await globby(`data/${dir}/*.json`, { cwd: root, absolute: true });
    const sourceField = sourceFields[dir];

    for (const file of files) {
      const relFile = path.relative(root, file);
      let entry;
      try {
        entry = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (err) {
        failures.push({ file: relFile, errors: [`invalid JSON: ${err.message}`] });
        continue;
      }

      if (!validate(entry)) {
        failures.push({
          file: relFile,
          errors: validate.errors.map((e) => `${e.instancePath || "/"} ${e.message}`),
        });
      }

      const expectedId = path.basename(file, ".json");
      if (entry.id && entry.id !== expectedId) {
        failures.push({
          file: relFile,
          errors: [`id "${entry.id}" does not match filename "${expectedId}"`],
        });
      }

      const sources = entry[sourceField];
      if (!Array.isArray(sources) || sources.length === 0) {
        failures.push({ file: relFile, errors: [`must have at least one ${sourceField} entry`] });
      } else {
        for (const s of sources) {
          if (typeof s.url !== "string" || !s.url.startsWith("https://")) {
            failures.push({ file: relFile, errors: [`${sourceField} url must be an https:// URL: ${s.url}`] });
          }
        }
      }
    }
  }

  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = await validateAll();
  if (failures.length > 0) {
    console.error(`Data validation failed (${failures.length} file(s) with errors):\n`);
    for (const { file, errors } of failures) {
      console.error(file);
      for (const err of errors) console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log("All data files valid.");
}
