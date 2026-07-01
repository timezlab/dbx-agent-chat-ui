# Tech Debt & Open Questions

Short entries only: symptom / question, where it bites, why it's deferred. Grep this
file — don't navigate subfolders.

## Open questions (block or could change the approach)

| # | Question | Impacts | Status |
|---|----------|---------|--------|
| Q1 | Is the Databricks agent exposed as Apps `/responses`, Model Serving `/serving-endpoints/responses`, or legacy `/chat/completions`? | Which transport adapter is the default ([`design-docs/chat-transport.md`](./design-docs/chat-transport.md)) | open |
| Q2 | Does the production endpoint require user authorization, or can app authorization handle the first release? | Auth assumptions at the wrapper layer ([`design-docs/repo-boundaries.md`](./design-docs/repo-boundaries.md)) | open |
| Q3 | Is static proxy mode same-origin, or does it need CORS and a configured `NEXT_PUBLIC_*` URL? | Endpoint config + CORS handling | open |
| Q4 | Should chat history be stored in Lakebase from the start, or added after the UI stabilizes? | Whether persistence stays a v1 non-goal ([`DESIGN.md`](./DESIGN.md)) | open |

## Known unknowns (not found in official Databricks docs reviewed)

Source: [`references/databricks-research.md`](./references/databricks-research.md)
(Unanswered / Not Found). The Databricks Apps docs reviewed did **not** state:

- A total maximum size for the whole app directory. → Treat the 10 MB per-file limit as the hard deployment constraint until documented otherwise.
- A special allowlist of file extensions for an Apps source directory.
- A maximum number of files specifically for an Apps deployment.

## Deferred work (tracked, not yet scheduled)

Deferred past v1 per [`DESIGN.md`](./DESIGN.md): Lakebase history, MLflow feedback
logging, multi-agent routing UI, file/image/multimodal inputs, advanced
SQL/table/chart rendering. These are product non-goals for now, not debt to pay
down — listed here so they aren't rediscovered as gaps.
