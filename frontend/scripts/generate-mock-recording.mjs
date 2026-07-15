#!/usr/bin/env node

// Generate the mock SSE recording (Responses API) for Replay Mode → `sse-recordings/default.txt`.
// A pure-Node port of the old generate_mock.py: charts moved from Pillow/PNG to base64 SVG
// vectors (zero-dependency, no system fonts required). The app renders
// `data:image/svg+xml;base64,…` images through the safe <img> path in
// src/lib/markdown/data-images.ts.
//
// After running this script, also run `node scripts/gen-replay-recording.mjs` to inline
// default.txt into the .generated.ts module (or use `pnpm mock:gen` to run both).

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(scriptDir, "../sse-recordings/default.txt");

/* ───────────────────────── SVG chart helpers ───────────────────────── */

const W = 660;
const H = 360;
const PAD_L = 62;
const PAD_R = 20;
const PAD_T = 46;
const PAD_B = 64;
const PW = W - PAD_L - PAD_R;
const PH = H - PAD_T - PAD_B;

const COLORS = ["#4F46E5", "#E11D48", "#0891B2"]; // indigo · rose · cyan
const GRID = "#E2E8F0";
const AXIS = "#64748B";
const LAB = "#334155";
const TIT = "#1E293B";

/** Round to 2 decimals to keep the SVG compact. */
const r = (n) => Math.round(n * 100) / 100;
/** Thousands separator, e.g. 4200 → "4,200". */
const commas = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svgShell(title, inner) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<text x="${W / 2}" y="20" text-anchor="middle" font-size="15" font-weight="bold" fill="${TIT}">${esc(title)}</text>` +
    inner +
    `</svg>`
  );
}

function dataUri(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function yAxis(parts, vmin, vmax, ticks, fmt) {
  for (let i = 0; i <= ticks; i++) {
    const v = vmin + (i * (vmax - vmin)) / ticks;
    const y = r(H - PAD_B - (i / ticks) * PH);
    parts.push(`<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
    parts.push(
      `<text x="${PAD_L - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="${AXIS}">${esc(fmt(v))}</text>`,
    );
  }
}

function legend(parts, items) {
  let x = PAD_L;
  const y = H - PAD_B + 30;
  for (const [label, color] of items) {
    parts.push(`<rect x="${x}" y="${y}" width="12" height="12" fill="${color}"/>`);
    parts.push(
      `<text x="${x + 18}" y="${y + 6}" dominant-baseline="middle" font-size="11" fill="${LAB}">${esc(label)}</text>`,
    );
    x += 18 + label.length * 6 + 20; // approximate width of 11px text
  }
}

function xLabels(parts, labels) {
  labels.forEach((m, i) => {
    const x = r(PAD_L + (i + 0.5) * (PW / labels.length));
    parts.push(
      `<text x="${x}" y="${H - PAD_B + 10}" text-anchor="middle" dominant-baseline="hanging" font-size="11" fill="${LAB}">${esc(m)}</text>`,
    );
  });
}

function lineChart({ title, months, series, vmin, vmax, ticks, fmt, legendItems }) {
  const parts = [];
  yAxis(parts, vmin, vmax, ticks, fmt);
  if (legendItems) legend(parts, legendItems);
  xLabels(parts, months);
  for (const [data, color] of series) {
    const pts = data.map((val, i) => {
      const x = r(PAD_L + (i + 0.5) * (PW / months.length));
      const y = r(H - PAD_B - ((val - vmin) / (vmax - vmin)) * PH);
      return [x, y];
    });
    parts.push(
      `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`,
    );
    for (const [x, y] of pts) parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`);
  }
  return dataUri(svgShell(title, parts.join("")));
}

function barChart({ title, segments, vals, vmax, ticks, color }) {
  const parts = [];
  yAxis(parts, 0, vmax, ticks, (v) => commas(v));
  segments.forEach((seg, i) => {
    const slotW = PW / segments.length;
    const cx = PAD_L + i * slotW + slotW / 2;
    const bw = slotW * 0.6;
    const x1 = r(cx - bw / 2);
    const y1 = r(H - PAD_B - (vals[i] / vmax) * PH);
    const y2 = H - PAD_B;
    parts.push(`<rect x="${x1}" y="${y1}" width="${r(bw)}" height="${r(y2 - y1)}" fill="${color}"/>`);
    parts.push(
      `<text x="${r(cx)}" y="${y1 - 5}" text-anchor="middle" font-size="10" fill="${LAB}">${commas(vals[i])}</text>`,
    );
    parts.push(
      `<text x="${r(cx)}" y="${H - PAD_B + 10}" text-anchor="middle" dominant-baseline="hanging" font-size="11" fill="${LAB}">${esc(seg)}</text>`,
    );
  });
  return dataUri(svgShell(title, parts.join("")));
}

const chartMrrTrend = () =>
  lineChart({
    title: "Monthly MRR Trend 2026 — Actual vs Budget vs SPLY ($K)",
    months: ["Jan", "Feb", "Mar", "Apr", "May"],
    series: [
      [[180, 190, 195, 205, 215], COLORS[0]],
      [[185, 195, 210, 225, 240], COLORS[1]],
      [[150, 160, 165, 170, 180], COLORS[2]],
    ],
    vmin: 100,
    vmax: 300,
    ticks: 4,
    fmt: (v) => commas(v),
    legendItems: [
      ["Actual", COLORS[0]],
      ["Budget", COLORS[1]],
      ["SPLY", COLORS[2]],
    ],
  });

const chartSegmentRev = () =>
  barChart({
    title: "YTD Revenue Jan–May 2026 by Segment ($K)",
    segments: ["Enterprise", "Mid-Market", "SMB", "Prosumer", "Startup"],
    vals: [4200, 2800, 1500, 800, 450],
    vmax: 5000,
    ticks: 5,
    color: COLORS[0],
  });

const chartMargin = () =>
  lineChart({
    title: "Monthly Gross Margin 2026 vs 2025 (%)",
    months: ["Jan", "Feb", "Mar", "Apr", "May"],
    series: [
      [[78.5, 78.2, 79.0, 75.4, 76.8], COLORS[0]],
      [[76.0, 76.5, 76.8, 77.0, 77.2], COLORS[1]],
    ],
    vmin: 60,
    vmax: 90,
    ticks: 6,
    fmt: (v) => v.toFixed(1),
    legendItems: [
      ["2026", COLORS[0]],
      ["2025", COLORS[1]],
    ],
  });

/* ───────────────────────── SSE event builders ───────────────────────── */

/** Chunk by code point (mirrors Python str[i:i+n]) so surrogate pairs stay intact. */
function chunkText(text, size = 4) {
  const cps = Array.from(text);
  const out = [];
  for (let i = 0; i < cps.length; i += size) out.push(cps.slice(i, i + size).join(""));
  return out;
}

const events = [];

function addReasoning(text) {
  for (const chunk of chunkText(text)) {
    events.push(
      JSON.stringify({
        type: "response.reasoning_text.delta",
        custom_outputs: null,
        item_id: "rs_a1b2c3d4",
        delta: chunk,
      }),
    );
  }
}

// Per-tool run time (ms), keyed by tool name → attached to each tool's output frame as
// `duration_ms` so the UI shows it on the tool row (and a reloaded conversation keeps it).
// Every call of a given tool reports the same realistic duration; a tool absent here simply
// omits the field (optional on the wire).
const TOOL_DURATION_MS = {
  write_todos: 40,
  read_file: 120,
  grep: 260,
  vector_search: 480,
  web_search: 1300,
  web_fetch: 900,
  task: 2100,
  execute_sql: 640,
  create_chart: 150,
  write_to_file: 210,
};

function addFc(callId, name, args, output = null) {
  events.push(
    JSON.stringify({
      type: "response.output_item.done",
      custom_outputs: null,
      item: {
        type: "function_call",
        id: `fc_${callId}`,
        call_id: `toolu_${callId}`,
        name,
        arguments: args,
        status: output ? "completed" : "pending",
      },
    }),
  );
  if (output) {
    const durationMs = TOOL_DURATION_MS[name];
    events.push(
      JSON.stringify({
        type: "response.output_item.done",
        custom_outputs: null,
        item: {
          type: "function_call_output",
          call_id: `toolu_${callId}`,
          output,
          ...(durationMs != null ? { duration_ms: durationMs } : {}),
        },
      }),
    );
  }
}

// Split text at each markdown data-URI image: send the image as a single delta, chunk the rest.
const IMG = /(!\[.*?\]\(data:image\/[^)]+\))/;

function addOutput(text) {
  for (const part of text.split(IMG)) {
    if (part.startsWith("![")) {
      events.push(
        JSON.stringify({
          type: "response.output_text.delta",
          custom_outputs: null,
          item_id: "msg_d046a17b",
          delta: part,
        }),
      );
    } else {
      for (const chunk of chunkText(part)) {
        events.push(
          JSON.stringify({
            type: "response.output_text.delta",
            custom_outputs: null,
            item_id: "msg_d046a17b",
            delta: chunk,
          }),
        );
      }
    }
  }
}

/* ───────────────────────────── Build story ───────────────────────────── */

addReasoning(
  "The user wants a GlobalTech YTD performance report for Jan–May 2026. I need: (1) the PnL framework & segment definitions from the wiki, (2) external market context via web search, (3) Actual/Budget/SPLY figures from data_agent, (4) charts for monthly MRR & segment breakdown, (5) recommended actions, (6) build the HTML report. Start by planning, then grep the wiki.",
);

const todos = [
  { content: "Grep wiki for GlobalTech PnL framework", status: "in_progress" },
  { content: "Web search market context and competitor landscape", status: "pending" },
  { content: "Query data_agent for GlobalTech overview performance", status: "pending" },
  { content: "Create charts for MRR trend and segment breakdown", status: "pending" },
  { content: "Generate actions based on margin and revenue gap", status: "pending" },
  { content: "Build final HTML report", status: "pending" },
];
addFc("01UUrhtQ", "write_todos", JSON.stringify({ todos }), "✅");

// Task 1: Wiki
addReasoning("Looking for GlobalTech's PnL structure documentation...");
addFc("01BTpAcr", "read_file", '{"file_path":"/skills/financial-analysis/SKILL.md","offset":0,"limit":100}', "✅");
addFc(
  "012Q9HAY",
  "grep",
  '{"pattern":"Revenue|MRR|segment","path":"/wiki/globaltech/","glob":null,"output_mode":"content"}',
  "/wiki/globaltech/sales.md: Revenue framework",
);

// Retrieve the exact definitions via vector search (output = array of chunks).
addReasoning("Grep only points at files — use vector_search to pull the exact segment definitions and revenue-recognition policy.");
addFc(
  "013VecSr",
  "vector_search",
  JSON.stringify({
    query: "GlobalTech revenue recognition policy and customer segment definitions",
    num_results: 3,
    index: "main.wiki.globaltech_docs",
  }),
  JSON.stringify(
    [
      {
        content:
          "Revenue is recognized ratably over the subscription term. MRR excludes one-off professional services, which are recognized on delivery.",
        source: "/wiki/globaltech/finance/revenue-recognition.md",
        score: 0.91,
      },
      {
        content:
          "Segments by annual contract value: Enterprise (>$100k), Mid-Market ($20k–100k), SMB (<$20k), Prosumer (self-serve), Startup (discounted program).",
        source: "/wiki/globaltech/sales/segments.md",
        score: 0.87,
      },
      {
        content:
          "SPLY (Same Period Last Year) is the standard YoY baseline used across all board and investor reporting.",
        source: "/wiki/globaltech/finance/glossary.md",
        score: 0.82,
      },
    ],
    null,
    2,
  ),
);

todos[0].status = "completed";
todos[1].status = "in_progress";
addFc("01GkGVnE", "write_todos", JSON.stringify({ todos }), "✅");

// Task 2: Web search — market context
addReasoning(
  "Before reading internal numbers, I need market context: SaaS industry growth, market share and competitor moves during Jan–May 2026. Call web_search for the market.",
);
// Real web_search tools return an array of result objects (url + preview/title), not a
// single blob — mirror that shape here (JSON-encoded, since `output` is a string field).
const marketResults = [
  {
    url: "https://www.gartner.com/en/newsroom/saas-market-h1-2026",
    title: "Global SaaS market grows 11.8% YoY in H1 2026",
    preview:
      "Worldwide SaaS spending rose 11.8% year over year in the first half of 2026, reaching an annualized run-rate of $312B. Data-platform and analytics categories led growth as enterprises consolidated tooling, while horizontal productivity suites decelerated. Gartner expects the pace to hold through H2 on AI-driven workloads despite tighter IT budgets.",
  },
  {
    url: "https://techcrunch.com/2026/05/28/globaltech-data-platform-share",
    title: "GlobalTech holds ~9% data-platform share, ranked #3",
    preview:
      "GlobalTech remains the #3 data-platform vendor at roughly 9% share, trailing two larger incumbents that together control just over half the market. Analysts credit its momentum to a strong Enterprise motion and a differentiated pricing model, but flag rising competition in the Mid-Market. Net revenue retention stayed above 115% for the fourth straight quarter.",
  },
  {
    url: "https://www.reuters.com/technology/rival-enterprise-price-cut-2026",
    title: "Rival cuts Enterprise pricing 8% to grab share",
    preview:
      "A leading competitor lowered Enterprise plan pricing by 8% effective March 2026 in an aggressive bid to win share ahead of renewal season. The move pressures list prices across the segment and could compress margins for vendors that match it. Several buyers are reportedly using the cut as leverage in multi-year negotiations.",
  },
  {
    url: "https://www.theinformation.com/articles/mid-market-saas-demand-2026",
    title: "Mid-Market SaaS demand surges as churn falls",
    preview:
      "Mid-Market demand is accelerating into 2026 as smaller teams standardize on fewer, deeper platforms. Industry churn fell to about 2.1% per month, the lowest in three years, helped by better onboarding and usage-based expansion. Vendors with fast time-to-value are capturing an outsized share of new logos in this tier.",
  },
  {
    url: "https://www.idc.com/getdoc.jsp?containerId=cloud-cost-2026",
    title: "Cloud infrastructure costs up 6% YoY, squeezing margins",
    preview:
      "Rising cloud infrastructure costs (+6% YoY) are pressuring gross margins across the SaaS industry, with data-intensive products hit hardest. IDC attributes the increase to GPU capacity demand and regional power constraints. Providers are responding with committed-use discounts and workload-placement optimization to protect unit economics.",
  },
];
addFc(
  "021WebMk",
  "web_search",
  JSON.stringify({
    query: "GlobalTech SaaS market share and competitor landscape 2026",
    max_results: 5,
    sources: ["news", "web"],
    location: "US",
    start_date: "2026-01-01",
    end_date: "2026-05-31",
  }),
  JSON.stringify(marketResults, null, 2),
);

// Drill into one result with web_fetch to read the full article (single-doc output).
addReasoning("The rival's Enterprise price cut is the sharpest signal — fetch that article in full.");
addFc(
  "022WebFt",
  "web_fetch",
  JSON.stringify({
    url: "https://www.reuters.com/technology/rival-enterprise-price-cut-2026",
    max_length: 4000,
    format: "markdown",
  }),
  "# Rival cuts Enterprise pricing 8% to grab share\n\n_Reuters · March 2026_\n\nA leading data-platform vendor has cut list pricing on its Enterprise tier by 8%, effective March 2026, in an aggressive move to win share ahead of the industry's renewal season.\n\nThe reduction applies to annual commitments above $100k and is paired with an expanded free-ingestion allowance. Executives framed it as \"passing scale efficiencies to customers,\" but analysts read it as a defensive response to slowing net-new bookings.\n\nBuyers are already using the cut as leverage: three Fortune 500 procurement teams told Reuters they have reopened multi-year negotiations. Competitors now face a choice between matching the cut — compressing gross margin — or defending price on differentiation and switching costs.\n\n> \"Discounting is the easy lever; the hard part is defending it without eroding unit economics,\" said one industry analyst.",
);

todos[1].status = "completed";
todos[2].status = "in_progress";
addFc("02BkTdo9", "write_todos", JSON.stringify({ todos }), "✅");

// Task 3: Data Agent
addReasoning("With external context in hand, call data_agent to pull GlobalTech's YTD data.");
addFc(
  "015vAcxa",
  "task",
  '{"description":"Retrieve GlobalTech overall performance overview for January to May 2026 (YTD).","subagent_type":"data_agent"}',
  "| MRR | Revenue | Margin |\\n| 8,724 | 10,171 | 76.8% |",
);

// Pull the concrete YTD figures straight from the warehouse (output = a table).
addReasoning("Get the exact YTD numbers from the warehouse with SQL for the report table.");
addFc(
  "016SqlYt",
  "execute_sql",
  JSON.stringify({
    query:
      "SELECT metric, jan, feb, mar, apr, may, actual_ytd, budget_ytd, sply_ytd, vs_plan_pct, vs_sply_pct FROM finance.globaltech.pnl_monthly WHERE period BETWEEN '2026-01' AND '2026-05' ORDER BY actual_ytd DESC",
    warehouse: "wh-analytics",
    catalog: "finance",
    schema: "globaltech",
  }),
  JSON.stringify(
    {
      // Wide table on purpose: 11 columns → the card scrolls horizontally.
      columns: [
        "Metric",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Actual YTD",
        "Budget YTD",
        "SPLY YTD",
        "vs Plan",
        "vs SPLY",
      ],
      rows: [
        ["Revenue", 1900, 1950, 2050, 2100, 2171, 10171, 10987, 8868, "-7.4%", "+14.7%"],
        ["MRR", 1680, 1720, 1740, 1780, 1804, 8724, 8978, 7226, "-2.8%", "+20.7%"],
        ["Services", 240, 250, 270, 280, 280, 1320, 1596, 1454, "-17.3%", "-9.2%"],
      ],
      row_count: 3,
      truncated: false,
    },
    null,
    2,
  ),
);

todos[2].status = "completed";
todos[3].status = "in_progress";
addFc("03AbCdef", "write_todos", JSON.stringify({ todos }), "✅");

// Task 4: Charts
addReasoning("Data is in; now build 3 charts: MRR Trend, Segment Revenue, and Gross Margin.");
const c1 = chartMrrTrend();
addFc("012gd2RB", "create_chart", '{"type":"line","title":"MRR Trend"}', "Chart stored. Place this token in your response: [chart:mrr]");

const c2 = chartSegmentRev();
addFc("017TWpdj", "create_chart", '{"type":"horizontal_bar","title":"Segment Revenue"}', "Chart stored. Place this token in your response: [chart:seg]");

const c3 = chartMargin();
addFc("01JM9Y3w", "create_chart", '{"type":"line","title":"Margin Trend"}', "Chart stored. Place this token in your response: [chart:mar]");

todos[3].status = "completed";
todos[4].status = "in_progress";
addFc("04DefGhi", "write_todos", JSON.stringify({ todos }), "✅");

// Task 5: Actions
addReasoning(
  "Analyze the gaps and propose actions. MRR is at 78.4% of plan — needs Enterprise upsell. Margin dipped in April on server costs (matches the external IDC signal), needs optimization.",
);
addFc("05GhiJkl", "read_file", '{"file_path":"/wiki/globaltech/action_guidelines.md","offset":0,"limit":100}', "Guideline: Priority 1 is MRR gap closure. Priority 2 is Margin protection.");

todos[4].status = "completed";
todos[5].status = "in_progress";
addFc("06JklMno", "write_todos", JSON.stringify({ todos }), "✅");

// Task 6: Build Report
addReasoning("Enough material now. Save the report to an HTML file and send markdown to the user.");
addFc("07MnoPqr", "write_to_file", '{"file_path":"/reports/2026/globaltech_ytd.html","content":"<html>...</html>"}', "✅ Saved to /reports/2026/globaltech_ytd.html");

todos[5].status = "completed";
addFc("08PqrStu", "write_todos", JSON.stringify({ todos }), "✅");

const outputText = `## GlobalTech — Business Performance Overview YTD Jan–May 2026

---

### 1. Key Financial Metrics (YTD May 2026)

| Metric | Actual YTD ($K) | Budget YTD ($K) | SPLY YTD ($K) | vs Plan | vs SPLY |
|---|---|---|---|---|---|
| **Revenue** | **10,171** | 10,987 | 8,868 | **-7.4%** | **+14.7%** |
| **MRR** | **8,724** | 8,978 | 7,226 | **-2.8%** | **+20.7%** |
| **Services** | **1,320** | 1,596 | 1,454 | **-17.3%** | **-9.2%** |

**Overview:** GlobalTech is growing strongly YoY (+14.7% Revenue) but tracking below plan. The pressure comes mostly from Services.

---

### 2. Market Context (source: web search, Jan–May 2026)

- Global SaaS market **+11.8% YoY** in H1 2026 — GlobalTech (+14.7%) is **outpacing the industry**.
- Holds **~9% share** of data platforms, ranked #3; the main rival **cut Enterprise pricing 8%** from March → price-competition pressure.
- **Mid-Market demand is rising**, industry churn down to ~2.1%/mo — room to expand.
- **Cloud costs +6% YoY** industry-wide → partly explains the April Gross Margin dip.

---

### 3. Monthly Trend — MRR

![MRR Trend](${c1})

> The gap vs Budget widens materially from April and May. Optimize the sales funnel.

---

### 4. Customer Segments (YTD May 2026)

![Segment Revenue](${c2})

> **Enterprise** makes up 41.9% of total Revenue. Large cross-sell headroom for Mid-Market.

---

### 5. Monthly Gross Margin

![Gross Margin](${c3})

> Gross Margin dropped sharply in April to 75.4% (a 5-month low) before recovering to 76.8% in May. Watch the cause (product mix, server costs).

---

### 6. Recommended Actions

**🔴 [High priority] Drive MRR — close the budget gap**
- **Why:** MRR is at 78.4% of plan — the biggest gap, directly affecting valuation; rivals are cutting Enterprise pricing.
- **Action:** Enterprise upsell campaign; optimize Mid-Market onboarding (where industry demand is rising).

**🟡 [Medium] Protect Gross Margin — prevent an April-style dip from recurring**
- **Why:** April margin dipped, infrastructure cost pressure rising (matches the cloud +6% YoY trend).
- **Action:** Optimize cloud servers; monitor third-party API costs.

---

**References**
[[1] sales-q2-2026.md](https://example.com/sales)
[[2] market-scan-2026 (web search)](https://example.com/market)

[Click here for the full report](https://example.com/report)

<suggested-followups>
  <question>Can you explain the services margin drop?</question>
  <question>What is our target for Enterprise Q3?</question>
</suggested-followups>
`;

addOutput(outputText);

// Usage / metrics for the reply (per-reply footer). tokens + cost are backend-only (the UI
// can't derive them); duration_ms + ttft_ms are OPTIONAL — the live client clock measures
// them while streaming, but sending them here means a RELOADED conversation still shows total
// time + TTFT. context_used/context_window feed the context-window meter (004): occupancy is
// context_used (a point-in-time Checkpoint size, NOT the cumulative total_tokens) over
// context_window. 128k/200k → ~64% so the ring shows a filled, click-to-/compact gauge in the
// mock. MUST arrive BEFORE the terminal `message` item, which closes the stream.
events.push(
  JSON.stringify({
    type: "response.completed",
    response: {
      usage: {
        input_tokens: 8450,
        output_tokens: 2130,
        total_tokens: 10580,
        cost_usd: 0.0623,
        duration_ms: 42600,
        ttft_ms: 1840,
        context_used: 128000,
        context_window: 200000,
      },
    },
  }),
);

events.push(
  JSON.stringify({
    type: "response.output_item.done",
    custom_outputs: null,
    item: {
      id: "msg_d046a17b",
      content: [{ text: outputText, type: "output_text", annotations: [] }],
      role: "assistant",
      type: "message",
    },
  }),
);

const body = events.map((ev) => `data: ${ev}\n\n`).join("");
await writeFile(OUTPUT, body, "utf8");
console.log(`Generated mock recording at ${OUTPUT} (${events.length} events).`);
