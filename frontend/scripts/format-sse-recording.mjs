#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = resolve(scriptDir, "../sse-recordings/rbg-performance.txt");
const DEFAULT_OUTPUT = resolve(scriptDir, "../sse-recordings/rbg-performance-2026.txt");

// Sticky regexes keep token detection cursor-safe instead of splitting on text inside JSON.
const DATA_PREFIX_RE = /data:[ \t]*/y;
const KEEPALIVE_RE = /:keepalive/y;

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: node scripts/format-sse-recording.mjs [input] [output]");
    console.log(`Default input:  ${DEFAULT_INPUT}`);
    console.log(`Default output: ${DEFAULT_OUTPUT}`);
    process.exit(0);
  }

  return {
    inputPath: resolve(argv[0] ?? DEFAULT_INPUT),
    outputPath: resolve(argv[1] ?? DEFAULT_OUTPUT),
  };
}

function skipWhitespace(input, cursor) {
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function matchSticky(regex, input, cursor) {
  regex.lastIndex = cursor;
  return regex.exec(input);
}

function findJsonEnd(input, cursor) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = cursor; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error(`Unclosed JSON object starting near offset ${cursor}.`);
}

function readDataRecord(input, cursor) {
  const match = matchSticky(DATA_PREFIX_RE, input, cursor);
  if (!match) {
    return null;
  }

  const valueStart = DATA_PREFIX_RE.lastIndex;

  if (input.startsWith("[DONE]", valueStart)) {
    return {
      line: "data: [DONE]",
      next: valueStart + "[DONE]".length,
      type: "data",
    };
  }

  if (input[valueStart] !== "{") {
    const snippet = input.slice(valueStart, valueStart + 80);
    throw new Error(`Unsupported data payload near offset ${valueStart}: ${snippet}`);
  }

  const valueEnd = findJsonEnd(input, valueStart);
  const jsonPayload = input.slice(valueStart, valueEnd);

  return {
    line: `data: ${JSON.stringify(JSON.parse(jsonPayload))}`,
    next: valueEnd,
    type: "data",
  };
}

function readKeepaliveRecord(input, cursor) {
  const match = matchSticky(KEEPALIVE_RE, input, cursor);
  if (!match) {
    return null;
  }

  return {
    line: ":keepalive",
    next: KEEPALIVE_RE.lastIndex,
    type: "keepalive",
  };
}

function formatSseRecording(input) {
  const normalizedInput = input.replace(/\r\n?/g, "\n");
  const records = [];
  let cursor = 0;
  let dataCount = 0;
  let keepaliveCount = 0;

  while (cursor < normalizedInput.length) {
    cursor = skipWhitespace(normalizedInput, cursor);
    if (cursor >= normalizedInput.length) {
      break;
    }

    const record =
      readDataRecord(normalizedInput, cursor) ?? readKeepaliveRecord(normalizedInput, cursor);

    if (!record) {
      const snippet = normalizedInput.slice(cursor, cursor + 100);
      throw new Error(`Unexpected SSE token near offset ${cursor}: ${snippet}`);
    }

    records.push(record.line);
    cursor = record.next;

    if (record.type === "data") {
      dataCount += 1;
    } else {
      keepaliveCount += 1;
    }
  }

  return {
    output: `${records.join("\n\n")}\n\n`,
    records: records.length,
    dataCount,
    keepaliveCount,
  };
}

const { inputPath, outputPath } = parseArgs(process.argv.slice(2));
const input = await readFile(inputPath, "utf8");
const result = formatSseRecording(input);

await writeFile(outputPath, result.output, "utf8");

console.log(
  `Formatted ${result.records} SSE records (${result.dataCount} data, ${result.keepaliveCount} keepalive) -> ${outputPath}`
);
