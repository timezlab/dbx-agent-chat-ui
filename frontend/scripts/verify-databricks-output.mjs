#!/usr/bin/env node
// Fail the build if any file in out/ exceeds the Databricks Apps per-file hard limit (10 MB).
// We use 9.5 MB as a safe margin to catch issues before deployment.

import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const OUT_DIR = "out";
const LIMIT_BYTES = 9.5 * 1024 * 1024;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(OUT_DIR);
const violations = [];

for (const file of files) {
  const { size } = await stat(file);
  if (size > LIMIT_BYTES) {
    violations.push({ file: relative(OUT_DIR, file), size });
  }
}

if (violations.length > 0) {
  console.error(
    `\n❌ Databricks Apps output check FAILED — ${violations.length} file(s) exceed 9.5 MB:\n`
  );
  for (const { file, size } of violations) {
    const mb = (size / 1024 / 1024).toFixed(2);
    console.error(`   ${file}  (${mb} MB)`);
  }
  console.error(
    "\nDatabricks Apps enforces a 10 MB per-file hard limit. Reduce bundle size before deploying.\n"
  );
  process.exit(1);
}

console.log(`✅ Databricks Apps output check passed — ${files.length} files, all under 9.5 MB.`);
