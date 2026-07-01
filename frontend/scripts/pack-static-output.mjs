#!/usr/bin/env node
// Zip the Next.js static export (out/) into release/dbx-agent-chat-ui-static.zip
// for one-file human upload to a proxy/static host that can unzip and serve the full tree.

import { createWriteStream, mkdirSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, relative } from "node:path";
import { pipeline } from "node:stream/promises";

const OUT_DIR = "out";
const RELEASE_DIR = "release";
const ARCHIVE_NAME = "dbx-agent-chat-ui-static.zip";
const ARCHIVE_PATH = join(RELEASE_DIR, ARCHIVE_NAME);

// Dynamically import the built-in zip writer if available, otherwise fall back to a tar approach.
// Node 22 ships with the Compression Streams API but not a built-in zip. We use the native
// zip CLI (available on macOS and Linux CI) as the simplest zero-dependency approach.

import { execSync } from "node:child_process";

mkdirSync(RELEASE_DIR, { recursive: true });

try {
  execSync(`zip -r ../${ARCHIVE_PATH} .`, { cwd: OUT_DIR, stdio: "inherit" });
  console.log(`✅ Packed static output → ${ARCHIVE_PATH}`);
} catch {
  console.error("❌ zip command failed. Ensure zip is installed (apt install zip / brew install zip).");
  process.exit(1);
}
