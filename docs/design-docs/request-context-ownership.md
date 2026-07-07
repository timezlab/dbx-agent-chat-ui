# Request Context Ownership: Thin Request + Two-Layer History/Checkpoint

**Status:** accepted
**Date:** 2026-07-07
**Covers:** spec 004 (FR-019..021) — context-window meter & manual `/compact`

## Context

The chat request originally sent the **full conversation history** on every turn
(`ChatRequest.messages: ChatRequestMessage[]`, oldest → newest). That made the UI the
owner of the model's working context: each turn re-uploaded every prior turn.

Feature 004 adds a **context-window meter** (occupancy of the model's working context)
and a **manual `/compact`** that asks the backend to summarize/shrink that context. Both
only make sense if the backend owns an accumulating **Checkpoint** — the working context
that grows per turn and that `/compact` reduces. If the client keeps re-sending full
history, then:

- The reported `input_tokens` reflect the client's re-uploaded history, not a
  backend-owned Checkpoint — the meter measures the wrong thing.
- `/compact` is cosmetic: even after the backend compacts, the very next turn re-inflates
  context from the client-sent history, so occupancy never actually drops.

There are genuinely **two different collections** that were being conflated:

1. **History** — the durable, human-facing transcript, persisted in a **Databricks table**
   and read back via the History API for display/reload. Never compacted; it is the record.
2. **Checkpoint** — the agent's **working context** (what the model actually reasons over).
   This is what grows, what the meter measures, and what `/compact` shrinks.

## Decision

### 1. Thin request — send only the current turn

`ChatRequest` carries only the **current user turn**, keyed to a conversation. The backend
owns and accumulates the Checkpoint by `conversationId`.

```ts
export const ChatRequestSchema = z.object({
  query: z.string(),                          // the current user turn ONLY
  attachments: z.array(AttachmentSchema).optional(), // files on THIS turn
  agentId: z.string().optional(),
  conversationId: z.string().optional(),      // Checkpoint key + correlation
});
```

The field is named **`query`** (not `messages`) precisely because it is no longer a history
array — it is one turn's input. `attachments` is a sibling field (files ride only on the
turn that carries them; they are never replayed). This is the exact wire body: the transport
POSTs `ChatRequest` verbatim as JSON.

### 2. Two-layer model — History (table) vs Checkpoint (agent context)

| Layer | Owner | Purpose | Compacted? |
| --- | --- | --- | --- |
| History | Databricks table (via History API) | display, reload, record | never |
| Checkpoint | backend agent, keyed by `conversationId` | model working context | yes — by `/compact` |

The UI never mutates either layer directly. Local `ChatSession.messages` remains the
**display** copy (what the user sees / what a reload rehydrates from History); it is
deliberately decoupled from what the request sends.

### 3. `/compact` is a normal turn

`/compact` is sent as ordinary `query` text; the backend regex-recognizes it and compacts
the Checkpoint, streaming a summary back as a normal assistant turn. No special request
field, no client-side history rewrite. (See spec 004 US2.)

## Alternatives considered

- **Keep `messages: [singleTurn]` (array of one).** Wire-compatible with the Responses
  `input` array and needs no rename, but keeps a plural "history" name that misrepresents
  the payload; readers keep assuming full history is sent. Rejected for clarity — the
  contract genuinely changed, so the name should too.
- **`query` as an object `{ content, attachments }`.** Slightly more structured but nests
  one level for no gain; `query: string` + sibling `attachments` is flatter and reads as a
  single input turn.
- **Client-side compaction (trim/replace prior turns with a summary marker).** Rejected:
  the client does not own the Checkpoint, would desync from the backend's real context, and
  would corrupt the durable History. Compaction must happen where the context lives.

## Consequences

**Better**

- Request payloads shrink to one turn — no geometric growth, well under Model Serving's
  16 MB/request limit even for long conversations.
- The meter is honest: occupancy reflects the backend Checkpoint, so `/compact` visibly
  lowers it.
- Clear separation of concerns: History (record) vs Checkpoint (working context).

**Worse / trade-offs**

- Continuation now **depends on the backend** persisting the Checkpoint per
  `conversationId`. A backend that does not accumulate context by conversation would lose
  prior-turn context. This is the single load-bearing external assumption — verify with a
  2-turn test before shipping.

**Must now be true**

- `ChatRequest` never contains prior turns; both the direct-send and queue-drain paths in
  `use-chat.ts` build a thin request.
- The backend accumulates the Checkpoint by `conversationId` and recognizes `/compact`.
- History (display/reload) is sourced from the Databricks table via the History API, not
  reconstructed from what the client last sent.
