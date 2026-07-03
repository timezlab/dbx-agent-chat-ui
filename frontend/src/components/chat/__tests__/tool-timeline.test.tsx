import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ToolActivityItem } from "@/entities";
import { ToolTimeline } from "@/components/chat/tool-timeline";

function tool(over: Partial<ToolActivityItem>): ToolActivityItem {
  return {
    id: "c1",
    name: "web_search",
    args: { query: "market" },
    detail: null,
    status: "done",
    ...over,
  };
}

/** Rows collapse by default (like the plan); open the first to inspect its body. */
function expandFirstRow() {
  fireEvent.click(screen.getAllByRole("button")[0]);
}

describe("ToolTimeline — web_search output", () => {
  const results = [
    {
      url: "https://www.gartner.com/en/newsroom/saas",
      title: "SaaS market grows 11.8% YoY",
      preview: "Worldwide SaaS spending rose 11.8% year over year.",
    },
    { url: "https://techcrunch.com/2026/globaltech", title: "GlobalTech at ~9% share" },
  ];

  it("renders web_search output as source cards (favicon + title + preview + link)", () => {
    render(<ToolTimeline items={[tool({ detail: JSON.stringify(results) })]} />);
    expandFirstRow();

    // Titles surface as links to each source url.
    const first = screen.getByRole("link", { name: /SaaS market grows/ });
    expect(first).toHaveAttribute("href", results[0].url);
    expect(screen.getByRole("link", { name: /GlobalTech at ~9% share/ })).toHaveAttribute(
      "href",
      results[1].url,
    );

    // Preview text is shown for the result that has one.
    expect(screen.getByText(/rose 11.8% year over year/)).toBeInTheDocument();

    // Favicon uses Google's s2 service keyed by the source host.
    const favicon = first.querySelector("img");
    expect(favicon).not.toBeNull();
    expect(favicon).toHaveAttribute(
      "src",
      expect.stringContaining("https://www.google.com/s2/favicons"),
    );
    expect(favicon).toHaveAttribute("src", expect.stringContaining("gartner.com"));
  });

  it("falls back to the raw output block when the payload is not a result array", () => {
    render(<ToolTimeline items={[tool({ detail: "just a string" })]} />);
    expandFirstRow();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("just a string")).toBeInTheDocument();
  });
});

describe("ToolTimeline — execute_sql output", () => {
  it("renders a { columns, rows } payload as a table", () => {
    const table = {
      columns: ["Metric", "Actual YTD"],
      rows: [
        ["Revenue", 10171],
        ["MRR", 8724],
      ],
      row_count: 2,
    };
    render(
      <ToolTimeline
        items={[
          tool({ name: "execute_sql", args: { query: "SELECT ..." }, detail: JSON.stringify(table) }),
        ]}
      />,
    );
    expandFirstRow();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Metric" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Revenue" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10171" })).toBeInTheDocument();
  });
});

describe("ToolTimeline — vector_search output", () => {
  it("renders retrieval chunks with source, score, and content", () => {
    const chunks = [
      { content: "Revenue is recognized ratably over the term.", source: "/wiki/rev.md", score: 0.91 },
    ];
    render(
      <ToolTimeline
        items={[
          tool({ name: "vector_search", args: { query: "revenue" }, detail: JSON.stringify(chunks) }),
        ]}
      />,
    );
    expandFirstRow();
    expect(screen.getByText("/wiki/rev.md")).toBeInTheDocument();
    expect(screen.getByText("0.91")).toBeInTheDocument();
    expect(screen.getByText(/recognized ratably/)).toBeInTheDocument();
  });
});
