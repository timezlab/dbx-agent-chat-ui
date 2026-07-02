# Feature Specification: Dev-tools SSE Replay

**Feature Branch**: `002-devtools-replay`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Dev-tools SSE Replay — drive the chat UI with a recorded Databricks Playground (Responses SSE) stream entirely client-side (no backend, no network) so it works even in the static-export/embed artifact. The sidebar Dev tools item only toggles Replay mode on/off; while on, the chat input is replaced by a Replay control (the area above the input is unchanged) offering play, pause, source, delay, and speed. Replay drives the same SSE parser and chat reducer as live streaming, is cancelable, and honors exactly one terminal. The committed default recording is regenerated from a longer real capture with base64 chart images stripped."

## Overview

The chat UI streams assistant responses from a Databricks Playground (Responses SSE)
endpoint. Verifying how a stream renders — tool timelines, reasoning, markdown, inline
images, streaming/skeleton effects, error toasts — currently requires either a live
Databricks agent or the dev-only same-origin mock endpoint. Neither is available in the
shipped static-export / embed artifact, and neither lets a developer deterministically
re-run a specific captured conversation, or pause and inspect it mid-stream.

**Replay** adds a developer/test-only capability to play back a recorded SSE stream
**entirely in the browser**, with no backend and no network call, so the exact same
rendering path can be exercised in any deployment target — including the single-file
embed — and driven from a known-good recording under transport-style controls
(play / pause / speed).

Interaction model:

- The existing **Dev tools** entry in the sidebar footer only **toggles Replay mode**
  on or off.
- While Replay mode is **on**, the chat **input/composer is replaced by a Replay control**;
  everything rendered **above** the input (e.g. the agent todo panel, the message list) is
  left unchanged. The Replay control exposes: **source**, **play**, **pause**, **delay**, and
  **speed**.
- While Replay mode is **off**, the UI behaves exactly as today (normal composer, live/mock
  streaming).

## Clarifications

### Session 2026-07-02

- Q: Should the Dev tools entry (and therefore Replay mode) be visible in production
  static-export / embed builds, or only during development? → A: Gated by a non-secret
  `NEXT_PUBLIC_*` flag (e.g. `NEXT_PUBLIC_DEV_TOOLS`), default **off**. The Dev tools entry —
  and therefore Replay mode — is hidden unless the flag is explicitly enabled at build/deploy
  time. This works uniformly across dev, static-export, and embed: a demo deploy sets the flag,
  a customer-facing deploy leaves it off.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Replay mode and play the default recording (Priority: P1)

A developer or reviewer opens the running app (in any deployment target, including the
static embed), enables **Replay mode** from the Dev tools entry, and sees the chat input
replaced by a Replay control with the **Default recording** selected. They press **Play**
and the chat surface plays back a realistic multi-tool, multi-turn assistant response
exactly as if it were streaming live — tool rows appear and resolve, reasoning and markdown
render progressively, and the turn settles to a completed message. Turning Replay mode off
restores the normal composer.

**Why this priority**: This is the core value and the minimum viable slice. It works with
zero configuration, zero Databricks access, and zero backend, so it is demonstrable on its
own in every deployment target and is the foundation the other stories build on.

**Independent Test**: With the app served as a pure static build (no mock endpoint
reachable), enable Replay mode, press Play with the default source, and confirm the recorded
conversation renders through the normal chat flow and reaches a completed state; then disable
Replay mode and confirm the normal composer returns.

**Acceptance Scenarios**:

1. **Given** the app is running with no chat endpoint reachable, **When** the user enables
   Replay mode, **Then** the chat input is replaced by the Replay control and the content
   above the input is unchanged.
2. **Given** Replay mode is on with the Default recording selected, **When** the user presses
   Play, **Then** a user turn and a streaming assistant turn appear and the assistant message
   progressively renders the recorded content to completion.
3. **Given** a replay reaches the end of the recording, **When** the final frame is processed,
   **Then** the assistant turn is marked complete and the control returns to a ready state
   (exactly one terminal outcome, no duplicate completion).
4. **Given** the default recording contains tool calls, reasoning, and markdown, **When** it
   plays back, **Then** those render through the same components as a live stream (visually
   indistinguishable from real streaming apart from timing).
5. **Given** Replay mode is on (playing or idle), **When** the user disables Replay mode,
   **Then** any in-progress replay is cancelled cleanly and the normal composer returns.

---

### User Story 2 - Pause and resume during playback (Priority: P1)

While a replay is playing, the developer presses **Pause** to freeze the stream at the
current frame so they can inspect a specific tool transition or a partially rendered message,
then presses **Play** to resume from where it paused.

**Why this priority**: Pause/resume is the reason the controls are inline rather than a
fire-and-forget action — it is the primary inspection affordance and part of the core
transport model the user asked for. It ships with US1 as the MVP control surface.

**Independent Test**: Start a replay, Pause partway, confirm no further frames render while
paused, then Play and confirm it continues to completion from the paused position.

**Acceptance Scenarios**:

1. **Given** a replay is playing, **When** the user presses Pause, **Then** frame rendering
   halts at the current position, the partial assistant output remains visible, and no
   terminal is emitted.
2. **Given** a replay is paused, **When** the user presses Play, **Then** playback resumes
   from the paused position without re-rendering already-shown frames.
3. **Given** a replay is paused, **When** the user disables Replay mode, **Then** the replay
   is cancelled cleanly (settling to a terminal) and the composer returns.

---

### User Story 3 - Choose the recording source (Priority: P2)

In the Replay control the developer opens the **source** selector and either keeps the
**Default recording** or chooses **Upload .txt** and picks a local recording file. The file
is read in the browser only; nothing is uploaded to any server.

**Why this priority**: Extends replay from a single canned demo to any captured stream, which
is the main day-to-day debugging value — but it depends on US1's playback engine and is not
required for the first demonstrable slice.

**Independent Test**: In the source selector choose a local `.txt` recording, Play, and
confirm its contents render through the chat flow identically to the default recording path.

**Acceptance Scenarios**:

1. **Given** the Upload source is selected and a valid `.txt` file is chosen, **When** the
   user presses Play, **Then** the chosen file's contents drive the replay and the file's
   name/size is shown in the control.
2. **Given** the Upload source is selected but no file is chosen, **When** the user views the
   control, **Then** Play is disabled until a file is provided.
3. **Given** a chosen file cannot be read or is empty, **When** the user attempts to Play,
   **Then** a clear inline error is shown and no empty/false replay starts.
4. **Given** a file is chosen and played, **When** the user reloads the app, **Then** the
   replayed conversation is not restored from history and no uploaded content was persisted.

---

### User Story 4 - Adjust delay and speed (Priority: P3)

The developer changes the per-frame **delay** and/or the playback **speed** in the Replay
control to slow playback down for inspection or speed it up to reach the end quickly, and can
reset delays to their defaults.

**Why this priority**: A convenience refinement on top of the playback engine. Valuable for
inspection but the feature is fully usable at default timing without it.

**Independent Test**: Set a slow speed (or large tool delay), Play, and observe tool rows
appear noticeably later; increase speed and confirm playback is faster; reset and confirm
delays return to defaults.

**Acceptance Scenarios**:

1. **Given** the control is shown, **When** the user views the timing settings, **Then** the
   delay values are pre-filled with defaults and speed defaults to normal (×1).
2. **Given** the user changes a delay or speed and plays, **When** playback runs, **Then** the
   pacing reflects the chosen delay scaled by the chosen speed.
3. **Given** the user changed delays, **When** they reset, **Then** delays return to defaults.
4. **Given** an invalid or out-of-range delay/speed, **When** the user attempts to Play,
   **Then** the value is rejected or clamped to a valid range and playback behaves safely
   (never hangs or busy-loops).
5. **Given** a replay is paused or playing, **When** the user changes speed, **Then** the new
   speed applies to subsequent frames without corrupting the current position.

---

### Edge Cases

- **Malformed recording**: A recording with unparsable or non-SSE lines MUST NOT crash the
  UI; unrecognized frames are skipped, and a recording that yields no valid frames surfaces a
  clear error rather than a silent no-op.
- **Recording carrying an error frame**: If the recording includes a stream error frame, the
  replay MUST surface it through the same error path as a live stream (including the persistent
  detailed error toast) and terminate cleanly.
- **Very large uploaded file**: An excessively large file MUST be rejected with a clear message
  rather than freezing the browser.
- **Non-`.txt` upload**: A file that is not a plain-text recording MUST be rejected before
  playback.
- **Play with no source**: Play MUST be disabled/blocked until a valid source is available.
- **Toggling mode mid-stream**: Disabling Replay mode during playback MUST cancel the replay
  cleanly (one terminal) and never leave a half-streamed assistant turn active under the normal
  composer.
- **Static-export purity**: The replay path MUST NOT introduce any dependency on a server
  route, so the shipped `output: "export"` build still builds and runs with replay available.
- **Embed self-containment**: In the single-file embed, the default recording MUST be present
  without any additional network fetch of a sibling file.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Dev tools entry in the sidebar footer MUST provide a control to toggle
  **Replay mode** on and off.
- **FR-002**: While Replay mode is on, the chat input/composer region MUST be replaced by a
  **Replay control**, and everything rendered above the input (e.g. the agent todo panel and
  the message list) MUST remain unchanged.
- **FR-002a**: The Replay control MUST occupy the **same footprint/size** as the chat input it
  replaces (same width and height, same surrounding padding/position), so swapping between
  composer and control causes **no layout shift** in the message area or the content above it.
- **FR-003**: While Replay mode is off, the UI MUST behave exactly as today (normal composer,
  live/mock streaming); toggling Replay mode off MUST restore the composer and cancel/clean up
  any in-progress replay (settling to a terminal).
- **FR-004**: The Replay control MUST expose, at minimum: a **source** selector, a **play**
  action, a **pause** action, a **delay** setting, and a **speed** setting.
- **FR-005**: The source selector MUST offer a **bundled default recording** and an
  **uploaded `.txt` file**.
- **FR-006**: The bundled default recording MUST ship inside the application bundle so it is
  available in every deployment target — including the single-file embed — with no additional
  network request.
- **FR-007**: Uploaded recordings MUST be read entirely client-side; the feature MUST NOT
  transmit recording contents to any server or backend.
- **FR-008**: When the Upload source is selected, the system MUST validate the chosen file
  (plain-text `.txt`, within a maximum size) and MUST show the file name and size in the
  control; invalid files MUST be rejected with a clear inline message.
- **FR-009**: Play MUST be disabled until a valid source is available; pressing Play MUST start
  playback (from the beginning) or resume playback (when paused).
- **FR-010**: Pause MUST suspend frame rendering at the current position while retaining partial
  output, and MUST NOT emit a terminal; a subsequent Play MUST resume from the paused position
  without re-rendering already-shown frames.
- **FR-011**: Starting a replay MUST create a user turn (a clearly labelled placeholder
  indicating this is a replay) followed by an assistant turn that renders progressively from
  the recording.
- **FR-012**: Replayed content MUST render through the **same** stream-parsing and chat-state
  update path as live streaming, so tool timelines, reasoning, markdown, and inline images
  render identically to a real stream.
- **FR-013**: A replay MUST be cancelable (via disabling Replay mode or an equivalent stop),
  retaining partial output and marking the turn stopped.
- **FR-014**: Every replay MUST resolve to exactly one terminal outcome (completed, error, or
  stopped) with no duplicate completion, matching the live streaming contract; pause/resume are
  not terminals.
- **FR-015**: The Replay control MUST expose configurable per-frame timing — a text-frame delay
  and a tool-frame delay — pre-filled with defaults and resettable to defaults, and a **speed**
  multiplier that scales those delays (default ×1).
- **FR-016**: Timing and speed inputs MUST be constrained to safe ranges; invalid values MUST be
  rejected or clamped so playback cannot hang or busy-loop; a speed change MUST apply to
  subsequent frames without corrupting the current position.
- **FR-017**: The default text-frame and tool-frame delays MUST match the values the existing
  dev mock endpoint uses, so default replay pacing matches the mock.
- **FR-018**: The frame-parsing and per-frame delay logic MUST be a single shared source used by
  both the replay path and the existing dev mock endpoint (no duplicated divergent logic).
- **FR-019**: Recordings MUST support the recorded Databricks Playground (Responses SSE) shape
  already produced by the mock and consumed by the live transport, including text deltas,
  reasoning, tool call / tool output frames, and a terminal.
- **FR-020**: Replayed recordings MUST NOT be persisted to conversation history or browser
  storage; a reload MUST NOT resurrect a replayed conversation as if it were real.
- **FR-021**: The committed default recording MUST be a realistic multi-tool, multi-turn stream
  that is small and text-only — it MUST NOT contain embedded base64 image data.
- **FR-022**: A repeatable script MUST regenerate the committed default recording from a longer
  local capture by stripping embedded base64 chart-image markdown, so the committed file stays
  small and readable while remaining a realistic stream.
- **FR-023**: A repeatable, automated step MUST inline the default recording into the bundle and
  run as part of the embed and manual build processes, keeping the bundled copy in sync with the
  committed recording.
- **FR-024**: The feature MUST remain UI-only and static-export safe: no backend/BFF, no auth,
  no server route dependency, and no secret in the browser bundle.
- **FR-025**: The system MUST handle malformed or empty recordings gracefully — skipping
  unrecognized frames and surfacing a clear error when a recording yields no playable frames —
  without crashing the UI.
- **FR-026**: The Dev tools / Replay entry MUST be gated by a non-secret `NEXT_PUBLIC_*` flag
  (e.g. `NEXT_PUBLIC_DEV_TOOLS`), defaulting to **off**. When the flag is off, no Dev tools
  entry and no Replay affordance is rendered in any build; when on, they are available. The flag
  MUST be a non-secret build/deploy-time selector consistent with Principle II, and its absence
  or an unset/false value MUST hide the feature.

### Key Entities *(include if feature involves data)*

- **Recording**: A text document representing a captured assistant response as a sequence of
  Server-Sent-Event data frames in the Responses SSE shape (text deltas, reasoning, tool
  call/output frames, and a terminal). Sourced either from the bundled default or an uploaded
  file. Text-only; no embedded binary/image payloads in the committed default.
- **Replay mode**: A UI-level on/off state that determines whether the composer or the Replay
  control occupies the input region. Ephemeral session state; not persisted.
- **Replay session state**: The transport-style state of one playback — selected source
  (default vs uploaded file reference), current position, playing/paused/idle status, per-frame
  delays, and speed multiplier. Ephemeral; not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from the Dev tools entry to a playing default recording in the
  static/embed build (no reachable backend) in **3 or fewer interactions** (toggle mode →
  Play).
- **SC-002**: **100%** of the recorded frame types present in the default recording (text,
  reasoning, tool call, tool output, terminal) render through the same components as a live
  stream, with no replay-only rendering differences other than timing.
- **SC-003**: A replay can be paused and resumed any number of times and still settles to
  exactly **one** terminal state (complete/stopped/error) with partial output retained —
  verified with **zero** cases of duplicate or missing completion, and **zero** frames rendered
  while paused, across repeated runs.
- **SC-004**: The committed default recording contains **zero** embedded base64 image payloads
  and stays under a small size budget (well under the per-file deployment limit), while still
  exercising at least one tool call, reasoning, and markdown.
- **SC-005**: The static-export build and the single-file embed build both succeed with the
  feature present, and the embed plays the default recording with **zero** additional network
  requests for recording data.
- **SC-006**: Replayed conversations never appear in restored history after reload (**0%**
  resurrection rate).
- **SC-007**: Enabling Replay mode leaves all content above the input unchanged and only
  replaces the input region (**0** unintended changes to the message list / todo panel), and
  the Replay control matches the composer's footprint with **0px** layout shift on toggle.

## Assumptions

- **Dev/test intent**: Replay is a developer/testing aid, not an end-user feature; its polish
  bar is functional correctness and safety. It is hidden by default and only appears when the
  `NEXT_PUBLIC_*` dev-tools flag is enabled (see Clarifications / FR-026).
- **Recording shape**: Recordings use the same Responses SSE shape the project already records
  for the mock endpoint and parses in the live transport; no new wire format is introduced.
- **Reused mechanisms**: Client-side file reading reuses the same in-browser file-reading
  approach as the existing attachment/upload feature; cancellation reuses the existing
  stop/abort path; error surfacing reuses the existing detailed-error toast.
- **Single active turn**: The app already serializes turns; replay obeys the same single-active
  -turn rules rather than introducing a parallel playback lane. Replay mode is expected to be
  the only stream source while it is on.
- **Speed model**: Speed is a multiplier applied over the base text/tool delays (e.g. ×0.5, ×1,
  ×2, ×4); default is ×1. Exact preset values are an implementation detail set in planning.
- **Default timing**: Base delays mirror the existing mock endpoint's text/tool delays so
  default replay pacing is familiar and consistent.
- **Source of the default recording**: The longer real capture used to regenerate the default
  recording is a local, non-committed file; only the small, image-stripped default recording is
  committed.
- **Upload limits**: A conservative maximum uploaded-file size (low-MB range) is enforced to
  protect the browser; the exact bound is set in planning.

## Dependencies

- The existing chat streaming pipeline (SSE parser + chat-state reducer + stop/cancel) that
  replay drives instead of the network transport.
- The existing Dev tools sidebar entry as the mode toggle.
- The existing composer/input region, which Replay mode swaps for the Replay control.
- The existing dev mock endpoint, whose frame-parsing and delay logic becomes the shared source
  reused by replay.
- The existing client-side file-reading approach used by the upload/attachment feature.
- The build pipeline (embed and manual builds) into which recording generation/inlining is
  wired.
