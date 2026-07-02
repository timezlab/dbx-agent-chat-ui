# Quickstart / Validation: Dev-tools SSE Replay

Run guide to prove the feature end-to-end. See [contracts/replay.md](./contracts/replay.md) and
[data-model.md](./data-model.md) for shapes; do not duplicate them here.

## Prerequisites

- `cd frontend && pnpm install`
- Enable the flag for dev: set `NEXT_PUBLIC_DEV_TOOLS=1` (e.g. in `.env.local`).

## Automated tests (TDD, run first — they must fail before implementation)

```bash
cd frontend
pnpm test            # vitest — recording, replay, useChat-replay, config, control, scripts
pnpm lint
```

Key suites:
- `lib/stream/__tests__/recording.test.ts` — `parseFrames` / `delayFor` parity with the mock.
- `lib/stream/__tests__/replay.test.ts` — one terminal per run; pause emits zero frames + no terminal;
  resume continues; abort → `abort`; speed scales delay (fake timers); empty/malformed → `error`.
- `hooks/chat/__tests__/use-chat.replay.test.ts` — replay creates labelled user + assistant turn,
  drives the reducer, and **never** calls `history.save`; toggling mode resets state.
- `lib/__tests__/config.test.ts` — `parseDevToolsEnabled` truthy/falsy/unset.
- `components/chat/__tests__/replay-control.test.tsx` — Play disabled until source; upload validation;
  wrapper/footprint classes match the composer.
- Script tests — strip removes base64 image markdown + `[chart]` from a fixture frame (no base64 in
  output); gen round-trips a fixture file into the module string.

## Manual validation

### US1 — Enable replay + play default (P1)
1. `pnpm dev`, open the app. Confirm the **Dev tools** entry is visible (flag on).
2. Toggle Dev tools → **Replay mode on**. The composer is replaced by the Replay control; the message
   list / todo area above is unchanged (no layout shift).
3. With **Default recording** selected, press **Play** → a labelled user turn + a streaming assistant
   turn render tool rows, reasoning, and markdown to completion (one terminal).
4. Toggle Replay mode **off** → the normal composer returns.
5. **Static/embed check**: `pnpm build:embed`, open `../embed.html` from `file://` (no server). With the
   flag baked on, Replay still plays the default with **zero** network requests (DevTools ▸ Network).

### US2 — Pause / resume (P1)
1. Play, then **Pause** mid-stream → output freezes, no new frames, no completion.
2. **Play** → resumes from the paused position to completion (still exactly one terminal).
3. Disable Replay mode mid-stream → replay cancels cleanly (turn marked stopped), composer returns.

### US3 — Source selection incl. upload (P2)
1. Source → **Upload .txt**, choose a local recording → name/size shown; Play renders it identically.
2. Choose a non-`.txt` or oversized file → rejected with an inline error, no replay starts.
3. Play a file, then **reload** → the replayed conversation is **not** restored (no persistence).

### US4 — Delay & speed (P3)
1. Increase tool delay or set speed ×0.5 → tool rows appear noticeably later; ×4 → faster.
2. **Reset** → delays return to defaults (20 / 400 ms), speed ×1.
3. Change speed while playing/paused → applies to subsequent frames without corrupting position.

## Build & size checks

```bash
cd frontend
pnpm build:embed     # runs gen-replay-recording first; embed self-contained, verify-embed passes
pnpm build:manual    # runs gen-replay-recording first; static export succeeds
node scripts/strip-recording-images.mjs   # regenerate default.txt from local capture (base64-free)
```

Expected: both builds succeed with the feature present; committed `default.txt` and the generated
module are text-only, contain **zero** base64 image payloads, and stay well under the 9.5 MB per-file
limit (SC-004/SC-005).

## Flag-off check (production default)

Unset `NEXT_PUBLIC_DEV_TOOLS` (or leave false) and rebuild → the **Dev tools** entry and every Replay
affordance are absent; there is no way to enter replay mode (FR-026).
