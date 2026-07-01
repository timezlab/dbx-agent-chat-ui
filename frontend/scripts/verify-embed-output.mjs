#!/usr/bin/env node
// Verify that the embed build produced the expected output files in out-embed/.

import { access } from "node:fs/promises";
import { constants } from "node:fs";

const EMBED_DIR = "out-embed";
const REQUIRED_FILES = ["index.html"];

const missing = [];

for (const file of REQUIRED_FILES) {
  try {
    await access(`${EMBED_DIR}/${file}`, constants.R_OK);
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error(
    `\n❌ Embed output check FAILED — missing file(s) in ${EMBED_DIR}/:\n`
  );
  for (const file of missing) {
    console.error(`   ${file}`);
  }
  process.exit(1);
}

console.log(`✅ Embed output check passed — required files present in ${EMBED_DIR}/.`);
