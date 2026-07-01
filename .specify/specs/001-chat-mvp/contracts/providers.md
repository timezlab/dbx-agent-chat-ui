# Contract: History, Feedback & Agents providers

Three host-optional capabilities, each behind an interface resolved from public config
(D8–D11). Components depend only on these interfaces — never on a URL or `fetch`. All
are UI-only: the UI calls host-provided endpoints, owns no backend, embeds no secret
(Principle I/II, FR-022). REST shapes below are the contract this UI expects a host to
satisfy; a host adapts its own service to them (or omits the URL to use the fallback).

## HistoryProvider (`src/lib/history/provider.ts`)

```ts
export interface HistoryProvider {
  /** Restore the persisted conversation on startup, or null if none. */
  load(): Promise<Conversation | null>;
  /** Persist the conversation (called on terminal turn transitions). */
  save(conversation: Conversation): Promise<void>;
}

export function resolveHistory(config: CapabilityConfig): HistoryProvider;
```

- `resolveHistory` returns the **remote** provider when `historyUrl` is set, else the
  **local** provider. A failover wrapper catches remote errors per call and delegates
  to local, so a runtime failure demotes history to local (FR-020, D9).
- **local**: `localStorage` keyed per app; on `localStorage` throw (private mode) it
  degrades to an in-memory map (FR-023).
- **remote** REST contract (real requests):
  - `GET  {historyUrl}` → `200 { conversation: Conversation | null }`
  - `PUT  {historyUrl}` body `{ conversation: Conversation }` → `2xx`
  - Any non-2xx / network error ⇒ treated as unavailable ⇒ local fallback.

## FeedbackSink (`src/lib/feedback/sink.ts`)

```ts
export interface Feedback {
  messageId: string;
  rating: "up" | "down";
  comment?: string;
}
export interface FeedbackSink {
  submit(feedback: Feedback): Promise<void>;
}
export function resolveFeedback(config: CapabilityConfig): FeedbackSink;
```

- `resolveFeedback` returns the **remote** sink when `feedbackUrl` is set, else the
  **mock** no-op/local sink (FR-021, D10).
- **remote** REST contract: `POST {feedbackUrl}` body `Feedback` → `2xx`.
- Submission is non-blocking for the UI: the rating updates optimistically; a rejected
  `submit` surfaces a non-blocking notice and retains the selection (edge case).

## AgentsClient (`src/lib/agents/client.ts`)

```ts
export interface Agent { id: string; name: string }
export interface AgentsClient {
  list(): Promise<Agent[]>;
}
export function resolveAgents(config: CapabilityConfig): AgentsClient | null;
```

- `resolveAgents` returns a **real** client when `agentsUrl` is set, else `null`
  (no selector). `list()` errors or an empty array ⇒ "no agents" ⇒ selector hidden,
  no `agentId` on requests (FR-024..FR-026, D11).
- **remote** REST contract: `GET {agentsUrl}` → `200 { agents: Agent[] }`.
- The selected `agentId` is injected into `ChatRequest.agentId` (see
  [`chat-transport.md`](./chat-transport.md)); it selects backend routing, not a
  different endpoint.

## Testing note

Every remote provider isolates `fetch` behind its interface, so it is unit-tested with
a mocked `fetch` (success + failure + malformed response), and the failover wrapper is
tested with a throwing remote + a spy local. No live backend is needed for CI.
