import { describe, expect, it } from "vitest";

import { createResponsesParser } from "@/lib/chat/responses";

describe("createResponsesParser — Databricks Playground Responses → ChatStreamEvent", () => {
  it("maps output_text.delta → token", () => {
    const p = createResponsesParser();
    expect(
      p.map({ type: "response.output_text.delta", item_id: "msg_1", delta: "Hi" }),
    ).toEqual([{ type: "token", delta: "Hi" }]);
  });

  it("maps reasoning_text.delta and reasoning_summary_text.delta → reasoning", () => {
    const p = createResponsesParser();
    expect(
      p.map({ type: "response.reasoning_text.delta", item_id: "rs_1", delta: "think" }),
    ).toEqual([{ type: "reasoning", delta: "think" }]);
    expect(
      p.map({ type: "response.reasoning_summary_text.delta", delta: "sum" }),
    ).toEqual([{ type: "reasoning", delta: "sum" }]);
  });

  it("maps a function_call item → a running tool with parsed args", () => {
    const p = createResponsesParser();
    const out = p.map({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "toolu_1",
        name: "grep",
        arguments: '{"pattern":"RBG","output_mode":"content"}',
        status: "completed",
      },
    });
    expect(out).toEqual([
      {
        type: "tool",
        id: "toolu_1",
        name: "grep",
        args: { pattern: "RBG", output_mode: "content" },
        detail: undefined,
        status: "running",
      },
    ]);
  });

  it("maps a function_call_output → a done tool paired by call_id, carrying the name", () => {
    const p = createResponsesParser();
    p.map({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        call_id: "toolu_1",
        name: "grep",
        arguments: '{"pattern":"x"}',
      },
    });
    const out = p.map({
      type: "response.output_item.done",
      item: { type: "function_call_output", call_id: "toolu_1", output: "3 matches" },
    });
    expect(out).toEqual([
      {
        type: "tool",
        id: "toolu_1",
        name: "grep",
        args: { pattern: "x" },
        detail: "3 matches",
        status: "done",
      },
    ]);
  });

  it("maps the terminal message item → done (text already streamed via deltas)", () => {
    const p = createResponsesParser();
    expect(
      p.map({
        type: "response.output_item.done",
        item: { id: "msg_1", type: "message", content: [{ text: "full answer" }] },
      }),
    ).toEqual([{ type: "done" }]);
  });

  it("maps an error frame → error", () => {
    const p = createResponsesParser();
    expect(
      p.map({ databricks_output: { error: "upstream exploded" } }),
    ).toEqual([{ type: "error", message: "upstream exploded" }]);
  });

  it("ignores lifecycle / unknown events (forward-compatible)", () => {
    const p = createResponsesParser();
    expect(p.map({ type: "response.created" })).toEqual([]);
    expect(p.map({ type: "response.output_item.added", item: {} })).toEqual([]);
    expect(p.map({ type: "response.output_text.done" })).toEqual([]);
    expect(p.map({ type: "response.completed" })).toEqual([]);
    expect(p.map("not an object")).toEqual([]);
  });
});
