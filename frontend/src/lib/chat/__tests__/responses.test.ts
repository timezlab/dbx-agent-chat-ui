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
    // A bare `response.completed` with no usage payload stays a no-op.
    expect(p.map({ type: "response.completed" })).toEqual([]);
    expect(p.map("not an object")).toEqual([]);
  });

  it("maps response.completed with response.usage → a usage event (tokens + cost)", () => {
    const p = createResponsesParser();
    expect(
      p.map({
        type: "response.completed",
        response: {
          usage: {
            input_tokens: 812,
            output_tokens: 391,
            total_tokens: 1203,
            cost_usd: 0.0041,
          },
        },
      }),
    ).toEqual([
      {
        type: "usage",
        inputTokens: 812,
        outputTokens: 391,
        totalTokens: 1203,
        costUsd: 0.0041,
      },
    ]);
  });

  it("reads usage from a top-level `usage` field and from databricks_output", () => {
    const p = createResponsesParser();
    expect(
      p.map({ type: "response.completed", usage: { total_tokens: 42 } }),
    ).toEqual([{ type: "usage", totalTokens: 42 }]);
    expect(
      p.map({ databricks_output: { usage: { input_tokens: 5, output_tokens: 7 } } }),
    ).toEqual([{ type: "usage", inputTokens: 5, outputTokens: 7 }]);
  });

  it("maps usage.context_window (and max_tokens alias) → contextWindow", () => {
    const p = createResponsesParser();
    expect(
      p.map({
        type: "response.completed",
        response: { usage: { total_tokens: 1203, context_window: 200000 } },
      }),
    ).toEqual([{ type: "usage", totalTokens: 1203, contextWindow: 200000 }]);
    // `max_tokens` is accepted as an alias when `context_window` is absent.
    expect(
      p.map({ type: "response.completed", usage: { max_tokens: 128000 } }),
    ).toEqual([{ type: "usage", contextWindow: 128000 }]);
    // Absent ⇒ the field is simply omitted.
    expect(
      p.map({ type: "response.completed", usage: { total_tokens: 42 } }),
    ).toEqual([{ type: "usage", totalTokens: 42 }]);
  });

  it("carries a backend per-tool duration_ms onto the done tool event", () => {
    const p = createResponsesParser();
    p.map({
      type: "response.output_item.done",
      item: { type: "function_call", call_id: "toolu_1", name: "grep", arguments: "{}" },
    });
    expect(
      p.map({
        type: "response.output_item.done",
        item: {
          type: "function_call_output",
          call_id: "toolu_1",
          output: "ok",
          duration_ms: 1234,
        },
      }),
    ).toEqual([
      {
        type: "tool",
        id: "toolu_1",
        name: "grep",
        args: {},
        detail: "ok",
        status: "done",
        durationMs: 1234,
      },
    ]);
  });
});
