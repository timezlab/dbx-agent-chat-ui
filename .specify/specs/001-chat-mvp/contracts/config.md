# Contract: Public configuration surface

The only knobs that reach the browser. All non-secret (Principle II). Defined in the
existing [`frontend/src/env.ts`](../../../../frontend/src/env.ts) via
`@t3-oss/env-nextjs` + `zod` — this feature reuses it as-is.

## Environment variables

| Variable | Type | Default | Meaning |
|----------|------|---------|---------|
| `NEXT_PUBLIC_CHAT_ENDPOINT_URL` | URL string (optional) | unset | The **single** chat endpoint the UI streams from (Databricks Playground SSE format). Real agent, proxy, or the local mock-api script — indistinguishable. Unset ⇒ inline notice. There is **no** transport-mode knob. |
| `NEXT_PUBLIC_HISTORY_API_URL` | URL string (optional) | unset | Remote conversation history endpoint. Unset ⇒ `localStorage` persistence. |
| `NEXT_PUBLIC_FEEDBACK_API_URL` | URL string (optional) | unset | Feedback submission endpoint. Unset ⇒ no-op/local mock sink. |
| `NEXT_PUBLIC_AGENTS_API_URL` | URL string (optional) | unset | Agents list endpoint. Unset ⇒ agent selector hidden. |

Each URL is **independent** — any subset may be set (FR-017). Contracts for the three
providers are in [`providers.md`](./providers.md).

### Rules

- `NEXT_PUBLIC_*` prefix only — anything else is unavailable client-side and MUST NOT
  hold secrets (Principle II, FR-014, FR-022).
- For local dev, point `NEXT_PUBLIC_CHAT_ENDPOINT_URL` at the mock-api script; history/
  feedback/agents left unset ⇒ localStorage history, mock feedback, no agent selector
  (SC-001, SC-004). The chat endpoint is the one URL the app needs to stream.
- The endpoint URL is configuration, never a hardcoded constant (FR-013). Per-vendor
  path/field/event *naming* lives in the single SSE handler, not in a UI component.
- "Capability present" = its URL is set **and** its calls succeed; a failed call
  demotes to the fallback at runtime (history→local, feedback→mock, agents→hidden).
- An unset `NEXT_PUBLIC_CHAT_ENDPOINT_URL` MUST surface a clear, non-crashing inline
  notice rather than failing silently (edge case).
- Remote calls carry no bundled secret; auth (if any) is same-origin/cookie handled by
  the deployment wrapper (FR-022). Calls MAY use `credentials: "include"`.
- Changing config MUST repoint the same built artifact without any source edit
  (SC-004, SC-006, SC-010).

## Customization contract touchpoints (this feature)

Reaffirmed from [`customization-and-theming.md`](../../../../docs/design-docs/customization-and-theming.md);
every new chat component MUST:

- Accept and forward `className`, merged **last** via `cn(...)` so consumer classes win
  (FR-016, SC-006).
- Expose a `data-slot` attribute for targeting.
- Read color/radius/font from the `globals.css` theme tokens — no hardcoded values a
  token already covers (FR-016).
- Accept the feedback handler as a prop (default no-op), never hardcode a backend call
  (FR-010).
