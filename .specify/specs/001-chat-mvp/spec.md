# Feature Specification: Chat MVP

**Feature Branch**: `001-chat-mvp`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "Chat MVP (D-014): a single reusable chat screen for a Databricks agent, driven entirely through the ChatTransport adapter against mockTransport (zero Databricks access). User can type a message and send it; an optimistic user message appears immediately and an assistant message streams in token-by-token. The user can cancel an in-progress generation. Assistant output renders markdown/code via streamdown. A tool-call/timeline placeholder surface shows agent tool activity. Errors from the stream are displayed inline. Optional feedback (thumbs up/down) buttons call a no-op/mock handler. The active transport mode is selectable at runtime via public config. Must stay UI-only and static-export safe; no secrets in the browser. Deferred: file/image upload, persistent history, MLflow logging, multi-agent routing, advanced SQL/table/chart rendering."

## Clarifications

### Session 2026-07-01

- Q: In feature 001, how far should the real Databricks transport adapters (Responses / Chat Completions / static-proxy) be built? → A: Interface + mock only — define the full transport interface and a working mock; real adapters are stubbed (not-implemented) and built in a later feature.
- Q: When the assistant is streaming and the user sends another message, what happens? → A: Queue it — accept the new message, hold it, and auto-send once the current generation finishes.
- Q: How does the mock transport produce its output stream? → A: Replay recorded SSE files only (no in-code scripted mode). A committed sample recording ships for the default demo/tests; local captures live in the gitignored `frontend/sse-recordings/`.

### Session 2026-07-01 (scope update — conversation history & feedback)

- Q: Should conversation history and richer feedback be their own feature or folded into 001? → A: Fold into 001 (history was previously a non-goal; it and feedback-with-comment are now in scope).
- Q: Where is history stored when there is no history API? → A: `localStorage` (persists across reload/tab close). The live conversation is always in browser RAM; localStorage is the persistence layer.
- Q: How are the chat / history / feedback endpoints configured, and how is "no history API" detected? → A: Each capability has its own public API URL config (chat, history, feedback). History is remote when its URL is configured and calls succeed; if the history URL is unset **or a history call fails**, that is treated as "no history" and the UI falls back to localStorage.
- Q: Is the remote history provider stubbed or built for real in this feature? → A: Built for real — the remote history adapter performs actual requests to the configured URL (tested with mocked fetch). This differs from the chat transport, whose real streaming adapters remain stubbed.
- Q: What does "feedback message" mean? → A: Thumbs up/down plus an optional free-text comment, submitted to a configurable feedback sink — a real POST to the configured feedback URL when set, otherwise a no-op/local mock.
- Q: How does selecting an agent affect a chat request? → A: A single chat endpoint (gateway); the chosen agent is sent as an `agentId` parameter in the chat request. The agents list holds id + name only (no per-agent endpoint).
- Q: What happens when there is no agents API (or the call fails)? → A: Hide the agent selector entirely and chat with the default chat endpoint (no `agentId`). The agents list is fetched for real from the configured agents URL when present.

### Session 2026-07-01 (architecture pivot — single endpoint, no transport modes)

Supersedes the earlier "mock is a transport mode that replays SSE files in-app" and
"transport mode is selectable" decisions above.

- Q: How does the frontend talk to a backend — via selectable transport "modes"? → A: **No modes.** The UI ALWAYS streams from **one** chat endpoint that speaks the **Databricks Playground / MLflow ResponsesAgent SSE format** (OpenAI Responses shape). What sits behind that endpoint — a real Databricks agent, a proxy, or a local mock — is a backend concern the UI cannot and need not distinguish. There is a single SSE handler; the transport is **live from day one** via `@microsoft/fetch-event-source` (pattern ported from `lakemind/frontend/lib/api/agent-stream.ts`).
- Q: Then what is "the mock"? → A: A standalone, dev-only **mock-api script** that serves a recorded stream in the exact Databricks Playground SSE format. Local dev points `NEXT_PUBLIC_CHAT_ENDPOINT_URL` at it, so the UI runs with zero Databricks access while remaining backend-agnostic. The committed recording is that script's data; `frontend/sse-recordings/` (gitignored) holds extra local captures.
- Q: What config knobs select the transport? → A: Just `NEXT_PUBLIC_CHAT_ENDPOINT_URL` (the one endpoint). `NEXT_PUBLIC_TRANSPORT_MODE` and any mock-recording knob are removed — the UI has no notion of adapter selection.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask and receive a streamed answer (Priority: P1)

An end user opens the chat screen, types a question, and sends it. Their message
appears instantly, and the agent's reply streams in progressively until complete.
The reply renders formatted text and code, not raw markup.

**Why this priority**: This is the product. Without a send→stream→render loop there
is no chat app. It is the smallest slice that demonstrates end-to-end value and can
ship on its own against the mock transport with zero Databricks access.

**Independent Test**: Load the app with the mock transport, type a message, send it,
and confirm the user message appears immediately and an assistant reply streams in and
settles into rendered markdown/code. Delivers a usable chat demo by itself.

**Acceptance Scenarios**:

1. **Given** an empty chat screen, **When** the user types text and sends, **Then** the user's message appears immediately at the bottom of the conversation.
2. **Given** a sent message, **When** the agent responds, **Then** an assistant message appears and its content grows incrementally as the response streams.
3. **Given** an assistant reply containing markdown and a code block, **When** streaming completes, **Then** the reply is shown as formatted prose with a distinct, readable code block.
4. **Given** an in-progress stream, **When** the user sends another message, **Then** the new message is queued (not sent yet) and auto-sends once the current generation finishes, so a single active generation is never corrupted.
5. **Given** an empty or whitespace-only input, **When** the user attempts to send, **Then** no message is sent.

---

### User Story 2 - Cancel a generation in progress (Priority: P2)

While the agent is still streaming a reply, the user can stop the generation and
regain control of the input to ask something else.

**Why this priority**: Long or wrong answers are common; the ability to stop is a
core usability expectation for agent chat and is cheap once streaming exists. Not P1
because a first demo can function without it.

**Independent Test**: Start a generation against the mock transport, trigger cancel
mid-stream, and confirm streaming halts, the partial reply is retained (marked as
stopped), and the input becomes ready for a new message.

**Acceptance Scenarios**:

1. **Given** an assistant reply is streaming, **When** the user activates cancel, **Then** streaming stops promptly and no further content is appended to that reply.
2. **Given** a cancelled generation, **When** streaming has stopped, **Then** the partial assistant reply remains visible and the composer is re-enabled for the next message.
3. **Given** no generation is in progress, **When** the chat is idle, **Then** no cancel affordance is offered.

---

### User Story 3 - See tool activity, errors, and give feedback (Priority: P3)

During a reply the user can see when the agent is using a tool (a timeline/activity
surface), sees a clear inline message if the stream fails, and can optionally rate a
completed reply with thumbs up/down plus an optional written comment. The rating and
comment are submitted to a configurable feedback sink.

**Why this priority**: These make the surface feel like a real agent UI and are in
D-014 scope, but the core send→stream loop delivers value without them. They layer on
top of the message model established by P1/P2.

**Independent Test**: Drive the mock transport to emit a tool-activity event, an error
frame, and a normal completion; confirm the timeline placeholder renders the tool
activity, the error is shown inline without crashing the app, and submitting feedback
(thumbs + comment) on a completed reply calls the configured sink (or the no-op mock
when none is configured) without visible error.

**Acceptance Scenarios**:

1. **Given** the agent emits tool activity during a reply, **When** those events arrive, **Then** a tool-call/timeline placeholder surface shows that activity distinct from the prose.
2. **Given** the stream emits an error, **When** the error arrives, **Then** an inline error message is shown on the affected reply and the app remains usable for the next message.
3. **Given** a completed assistant reply, **When** the user selects thumbs up or thumbs down and optionally types a comment and submits, **Then** the feedback (rating + comment) is sent to the configured feedback sink, or to the no-op/mock sink when no feedback URL is configured, and the chosen state is reflected in the UI.
4. **Given** no feedback URL is configured, **When** the user submits feedback, **Then** the mock sink is invoked and the UI still reflects the selection (never errors for lack of a backend).

---

### User Story 4 - Conversation history that survives reloads (Priority: P2)

The user's conversation is not lost on reload. When the host provides a history API,
past conversations load from it and new turns are saved to it; when it does not (or a
history call fails), the conversation persists locally so it survives a page reload.

**Why this priority**: Losing the conversation on refresh is a major usability gap for
a real chat app. It is P2 (alongside cancel) because the core send→stream loop (P1)
can demo without it, but a shippable product needs continuity. It must handle both the
"history API present" and "no history API" cases per the deployment host.

**Independent Test**: With no history URL configured, hold a conversation, reload the
page, and confirm it is restored from localStorage. Separately, with a history URL
configured, confirm past conversations load from it and new turns are saved; then
simulate a failing history call and confirm the UI falls back to localStorage without
crashing.

**Acceptance Scenarios**:

1. **Given** no history API is configured, **When** the user reloads the page after chatting, **Then** the prior conversation is restored from local persistence.
2. **Given** a history API is configured and healthy, **When** the app loads, **Then** prior conversation(s) are fetched from it; **And When** a turn completes, **Then** the updated conversation is saved to it.
3. **Given** a history API is configured but a call fails (error or unreachable), **When** the failure occurs, **Then** the UI treats history as unavailable, falls back to local persistence, and remains usable — no crash, no data loss of the in-session conversation.
4. **Given** local persistence holds a conversation, **When** the user clears/starts a new conversation, **Then** the persisted state updates accordingly (no stale conversation resurrected on next load).

---

### User Story 5 - Choose which agent to chat with (Priority: P3)

When the host exposes multiple agents, the user can see the available agents and pick
which one answers. The chosen agent is included with each message so the backend routes
to it. When no agents API is configured, this surface shows a default 'Agent' option
and chat proceeds against the default endpoint.

**Why this priority**: Multi-agent hosts need a way to target an agent, but the core
chat loop (P1) works against a single default agent without it. It is additive to the
message-send path.

**Independent Test**: With an agents URL configured to return a list, confirm the
selector shows the agents and selecting one causes subsequent chat requests to carry
that agent's id. With no agents URL (or a failing call), confirm the selector is hidden
and chat still works against the default endpoint.

**Acceptance Scenarios**:

1. **Given** an agents API is configured and returns a list, **When** the app loads, **Then** the agent selector shows the available agents (by name).
2. **Given** agents are listed, **When** the user selects an agent and sends a message, **Then** the request includes the selected agent's id and the reply comes from that agent.
3. **Given** no agents API is configured, **When** the app loads, **Then** the agent selector shows a default "Agent" option and chat uses the default chat endpoint with no agent id.
4. **Given** an agents API is configured but the call fails, **When** the failure occurs, **Then** the selector shows a default "Agent" option, a non-crashing state results, and chat still works against the default endpoint.

---

### Edge Cases

- **Empty/whitespace input**: sending is a no-op (no empty user bubble, no request).
- **Cancel at the very start or very end of a stream**: cancel is idempotent and never leaves a permanently "streaming" bubble.
- **Error before any content**: an assistant reply that errors with zero streamed tokens still shows the inline error, not a blank bubble.
- **Rapid repeated sends**: only one generation is active at a time; additional sends are queued in order and dispatched one at a time after the current generation completes.
- **Cancel with a queued message pending**: cancelling the active generation does not silently drop a queued message; the queued message either sends next or is clearly retained, never lost without indication.
- **Long unbroken output / long code lines**: content wraps or scrolls within the message; it does not break page layout.
- **Missing chat endpoint config**: with `NEXT_PUBLIC_CHAT_ENDPOINT_URL` unset, the app surfaces a clear, non-crashing inline message rather than failing silently (local dev points it at the mock-api script).
- **Feedback pressed twice / toggled**: feedback reflects a single current choice; toggling is allowed and does not spawn duplicate submissions beyond the intended sink call.
- **History call fails or times out**: the UI treats history as unavailable and falls back to local persistence; the in-session conversation is never lost because of a history error.
- **History save fails mid-session**: a failed save does not break the chat; the conversation continues and is still persisted locally as a fallback.
- **Corrupt or unreadable local persistence**: if stored history cannot be parsed, the app starts a clean session rather than crashing.
- **localStorage unavailable (private mode / disabled)**: the app degrades to in-memory only (conversation lost on close) without crashing.
- **Each capability configured independently**: chat, history, and feedback each have their own optional API URL; any subset may be configured, and an unset one uses its local/mock fallback.
- **Feedback sink failure**: a failed feedback submission surfaces a non-blocking notice and does not lose the user's selection or break the chat.
- **Agents API fails or returns an empty list**: the agent selector shows a default 'Agent' option and chat proceeds against the default endpoint with no agent id; no crash.
- **Selected agent disappears on refetch**: if a previously selected agent is no longer in the list, the selection resets to none/default rather than sending a stale id.
- **Switching agent mid-session**: changing the selected agent applies to subsequent messages; it does not rewrite or corrupt earlier turns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present a single chat screen with a message list and a text composer for sending messages.
- **FR-002**: Users MUST be able to submit a non-empty message, which appears in the conversation immediately (optimistically) as a user message.
- **FR-003**: The system MUST reject empty or whitespace-only submissions without creating a message or a request.
- **FR-004**: The system MUST display the agent's reply as an assistant message whose content updates incrementally while the response streams.
- **FR-005**: The system MUST render completed assistant content as formatted markdown, including readable code blocks, rather than raw markup.
- **FR-006**: Users MUST be able to cancel an in-progress generation, after which streaming stops, the partial reply is retained and marked as stopped, and the composer is re-enabled.
- **FR-007**: The system MUST allow only one active generation at a time. When the user sends while a generation is active, the system MUST queue the new message in order and auto-send it once the current generation completes; content from different generations MUST NOT interleave into a single reply.
- **FR-008**: The system MUST present a tool-call/timeline placeholder surface that reflects agent tool-activity events when they occur, visually distinct from prose.
- **FR-009**: The system MUST display stream errors inline on the affected reply and remain usable for subsequent messages after an error.
- **FR-010**: The system MUST offer feedback on completed assistant replies consisting of a thumbs up / thumbs down rating and an optional free-text comment. Submitting MUST send the rating and comment to a configurable feedback sink and reflect the selected state in the UI.
- **FR-011**: The system MUST obtain agent responses exclusively through a single transport abstraction (`ChatTransport`), so that no chat UI component performs I/O or is bound to a specific backend. There are **no transport "modes"**: the UI always streams from **one** chat endpoint that speaks the **Databricks Playground / MLflow ResponsesAgent SSE format**. A single SSE handler maps that vendor shape → the neutral internal event vocabulary. The transport is live from day one (via `@microsoft/fetch-event-source`); whatever answers the endpoint (real agent, proxy, or mock) is indistinguishable to the UI.
- **FR-011a**: Zero-Databricks operation MUST be provided by a standalone, dev-only **mock-api script** that serves a recorded stream in the exact Databricks Playground SSE format — NOT by an in-app transport mode. A committed sample recording MUST ship so the default demo and tests work out of the box; additional local captures live in the gitignored `frontend/sse-recordings/` directory and are never required for the build or tests to pass. The UI points at the mock-api script purely via `NEXT_PUBLIC_CHAT_ENDPOINT_URL` and cannot tell it apart from a real endpoint.
- **FR-012**: The chat endpoint MUST be selected purely by non-secret public configuration (`NEXT_PUBLIC_CHAT_ENDPOINT_URL`). There is no transport-mode switch; repointing the UI at a different endpoint (real, proxy, or mock-api) requires no source edit.
- **FR-013**: The endpoint URL MUST be configuration, never a hardcoded constant, so a host can repoint the UI without editing source. Per-vendor path/field/event *naming* belongs to the single SSE handler, not to any UI component.
- **FR-014**: The browser bundle MUST NOT contain secrets, credentials, or tokens; only non-secret public configuration may reach the client.
- **FR-015**: The app MUST build as a static export with no server runtime, server actions, or request-time server features.
- **FR-016**: Every chat UI component MUST accept a consumer-provided style override (a `className`) that is applied last so consumer styles win, and MUST derive visual tokens (color/radius/font) from theme variables rather than hardcoded values.
- **FR-017**: The chat, history, and feedback capabilities MUST each be configured by their own independent, non-secret public API URL. Any subset may be set; an unset capability MUST use its defined local/mock fallback.
- **FR-018**: The system MUST persist the active conversation so it survives a page reload. When no history API URL is configured, persistence MUST use browser `localStorage`; the live conversation always resides in browser memory during the session.
- **FR-019**: When a history API URL is configured, the system MUST load prior conversation state from it on startup and save conversation updates to it as turns complete (a real request to the configured URL).
- **FR-020**: If a history API call fails for any reason (unset URL, network error, error response), the system MUST treat history as unavailable, fall back to local persistence, keep the in-session conversation intact, and remain usable — never crash.
- **FR-021**: When a feedback API URL is configured, submitting feedback MUST send the rating and comment to it (a real request); when it is unset, feedback MUST go to a no-op/local mock sink. A feedback submission failure MUST be non-blocking and MUST NOT lose the user's selection or break the chat.
- **FR-022**: History and feedback network access MUST remain UI-only and secret-free: the UI calls host-provided endpoints selected purely by public configuration, embeds no credentials in the bundle, and owns no history/feedback backend (auth, if any, is handled by the deployment wrapper, e.g. same-origin session, outside this repo).
- **FR-023**: If local persistence is unavailable or unreadable (private mode, disabled storage, corrupt data), the system MUST degrade gracefully to an in-memory session without crashing.
- **FR-024**: When an agents API URL is configured, the system MUST fetch the list of available agents (id + display name) from it (a real request) and present a selector of those agents.
- **FR-025**: Users MUST be able to select an agent from the list, and the system MUST include the selected agent's id with each chat request sent to the (single) chat endpoint. The agent id changes only what the backend routes to; it is not a separate endpoint.
- **FR-026**: When no agents API URL is configured, or the agents call fails or returns an empty list, the system MUST show a default 'Agent' option and send chat requests to the default chat endpoint with no agent id — without crashing.

### Key Entities

- **Message**: One turn in the conversation. Role (user or assistant), text content, and status (e.g., idle, streaming, stopped, error). Assistant messages may additionally carry tool-activity items, an error, and a feedback selection.
- **Tool-activity item**: A record of agent tool usage shown on the timeline surface — the tool's name (which identifies the kind of activity) plus its structured arguments and enough detail to distinguish it from prose. A recognized tool may render specifically; an unrecognized one shows generically. Placeholder fidelity in this feature.
- **Conversation**: The ordered list of messages for a chat session, plus an identifier. Lives in browser memory during the session and is persisted (locally or via the history API) so it survives reloads.
- **Chat endpoint**: The single, non-secret endpoint URL the UI streams from (Databricks Playground SSE format). No mode/adapter selection — one endpoint, whatever answers it.
- **Capability configuration**: The set of independent, non-secret public API URLs — one each for chat, history, feedback, and agents. Any may be unset, selecting that capability's local/mock/hidden fallback (an unset chat endpoint surfaces an inline notice).
- **Agent**: A selectable backend agent, identified by id with a human-readable display name. Fetched from the agents API when configured.
- **Agent selection**: The currently chosen agent id (or none), included with chat requests; resets to none if the selected agent leaves the list.
- **History provider**: The abstraction that loads and saves conversation(s). Two implementations: a remote provider (real requests to the configured history URL) and a local provider (`localStorage`, with in-memory degradation). Selection and failover between them is runtime, based on config and call success.
- **Feedback**: A per-reply submission of a rating (up / down) and an optional free-text comment.
- **Feedback sink**: The abstraction that receives a submitted Feedback. Two implementations: a remote sink (real request to the configured feedback URL) and a no-op/local mock sink used when no URL is configured.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can send a message and see an assistant reply begin streaming within a few seconds, with the chat endpoint pointed at the local mock-api script (zero Databricks access).
- **SC-002**: 100% of assistant replies containing markdown and code render as formatted text with a distinct code block (no raw markup visible) once streaming completes.
- **SC-003**: Cancelling a generation stops new content from appearing within about one second and always returns the composer to a ready state (no stuck "streaming" bubble in any test case).
- **SC-004**: The same built artifact runs against the mock-api script with no Databricks access and can be repointed to a real/proxy endpoint purely by changing `NEXT_PUBLIC_CHAT_ENDPOINT_URL` — no source edit required.
- **SC-005**: A stream error is always shown to the user inline and never prevents sending the next message (0 unrecoverable states across error test cases).
- **SC-006**: A consumer can restyle the chat surface (theme tokens and per-component class override) and change the endpoint configuration without editing any component source file.
- **SC-007**: The production build passes the static-export and no-secrets-in-bundle checks with zero violations.
- **SC-008**: With no history API configured, a conversation held before a page reload is fully restored after reload in 100% of test cases (no lost turns).
- **SC-009**: A failing history or feedback call never crashes the app and never loses the in-session conversation (0 unrecoverable states across failure test cases); the UI falls back to local persistence / mock sink.
- **SC-010**: The chat, history, feedback, and agents capabilities can each be independently pointed at a host-provided URL (or left unset for local/mock/hidden) purely through public configuration — no source edit required.
- **SC-011**: With an agents API configured, a user can select an agent and 100% of subsequent chat requests carry that agent's id; with no agents API, the selector is absent and chat still succeeds against the default endpoint.

## Assumptions

- **Conversation persists across reloads** (see Clarifications): The live conversation is in browser memory during the session and is persisted via the history API when configured, otherwise via `localStorage`; it degrades to in-memory only if storage is unavailable. Databricks/Lakebase-specific history integration is NOT owned here — the UI only talks to a generic, host-provided history endpoint by configuration.
- **Single live transport, backend-agnostic** (see Clarifications — architecture pivot): The UI streams from one Databricks Playground-format SSE endpoint via a single handler (live from day one). It does not know or care whether a real agent, a proxy, or the mock-api script answers. There are no in-app transport "modes" or stubbed adapters; the SSE-mapping handler is in scope and shared by every source.
- **Zero-Databricks dev via a mock-api script** (see Clarifications — architecture pivot): A standalone dev-only mock-api script serves recorded streams in the exact Databricks Playground SSE format (tool activity, reasoning, errors). Local dev points `NEXT_PUBLIC_CHAT_ENDPOINT_URL` at it. One sample recording is committed so default demo/tests run without setup; other captures are local-only under the gitignored `frontend/sse-recordings/` and are never needed for CI.
- **Feedback goes to a generic sink** (see Clarifications): Feedback (rating + optional comment) is submitted to a configured feedback URL when set, otherwise to a no-op/local mock. MLflow-specific feedback logging is NOT owned here; the UI only POSTs to a generic, host-provided feedback endpoint by configuration.
- **Agent selection, not routing** (see Clarifications): The user manually picks one agent to chat with, sent as `agentId` to the single chat endpoint. Automatic multi-agent routing / orchestration UI remains out of scope; the agents list is host-provided and this repo owns no agent registry.
- **Changing agent starts fresh context as needed**: Switching the selected agent affects subsequent messages only; earlier turns are unchanged. Whether the backend keeps or resets context per agent is the backend's concern.
- **Text-only input/output**: No file, image, or multimodal input; no advanced SQL/table/chart rendering beyond standard markdown/code — all deferred.
- **Desktop-first, responsive-friendly**: Primary target is a standard desktop browser; layout should not break on smaller widths but dedicated mobile optimization is not a goal of this feature.
- **Accessibility baseline**: Keyboard send and focus handling follow standard form conventions; a full accessibility audit is out of scope for this feature.
- **Constitution constraints inherited**: UI-only, static-export-safe, no secrets in the bundle, backends only via the transport adapter, and customization-as-a-contract are non-negotiable and shape every requirement above.
