# Databricks auth & current-user identity for the chat UI

Research (2026-07-02) for showing the logged-in user's info in the chat sidebar, across
the two hosting modes this UI targets. Conclusion first, evidence after.

## TL;DR — design conclusion

In **both** modes the browser bundle cannot learn the visiting user's identity by
itself: Databricks deliberately blocks browser calls to its REST API
([KB: CORS policy error](https://kb.databricks.com/security/cors-policy-error-when-trying-to-run-databricks-api-from-a-browser-based-application)),
and JS can never read the identity headers the platform injects into page requests.
Identity therefore always flows **platform proxy → hosting backend (headers) → tiny
`GET /api/me`-style JSON endpoint → this UI**.

That fits the existing provider pattern (`historyUrl` / `feedbackUrl` / `agentsUrl`,
see [`providers.md`](../../.specify/specs/001-chat-mvp/contracts/providers.md)):
add an optional **`NEXT_PUBLIC_USER_API_URL`** → `UserProvider`; when unset or the
fetch fails, the sidebar simply hides the user block. Proposed contract:

```
GET {userUrl} → 200 { user: { email?, username?, displayName? } | null }
```

This matches Databricks' own `e2e-chatbot-app-next` template, which exposes
`GET /api/session` returning `{ user: { email, name, preferredUsername } }`
([session route](https://github.com/databricks/app-templates/blob/main/e2e-chatbot-app-next/server/src/routes/session.ts)).
No avatar exists anywhere in the platform — render initials from name/email.

## Case 1 — Flask/FastAPI in a notebook, served via cluster driver proxy

URL shape: `https://<host>/driver-proxy/o/<org-id>/<cluster-id>/<port>/`.

- **AuthN**: the normal Databricks workspace web session (SSO cookie) — unauthenticated
  visitors are redirected to workspace login. The `/driver-proxy-api/` variant is the
  Bearer-token flavor for programmatic calls.
- **AuthZ**: cluster ACL — any user with **Can Attach To** on the cluster can open the
  app (officially documented for the analogous Shiny case:
  [sparkr/shiny docs](https://docs.databricks.com/aws/en/sparkr/shiny)). Note Can
  Attach To also allows running arbitrary code on that cluster.
- **Getting the visitor's identity** — options, best first:
  1. ✅ **Backend reads proxy-injected headers** `X-Databricks-User-Name` (email) and
     `X-Databricks-User-Id`, exposes them via `/api/me`. Community-evidenced, **not
     officially documented**: dbtunnel reads exactly these headers
     ([simple_proxy.py](https://github.com/stikkireddy/dbtunnel/blob/main/dbtunnel/vendor/asgiproxy/simple_proxy.py)),
     and a captured cluster `spark-defaults.conf` shows the platform mapping for them.
     **Verify empirically per workspace** (ship a debug endpoint dumping received
     headers) before promising the sidebar feature.
  2. ❌ Browser same-origin fetch to `GET /api/2.0/preview/scim/v2/Me` with the session
     cookie: no evidence it works; the REST API is documented token-auth only. If it
     worked, dbtunnel would not have needed its paste-a-PAT login page.
  3. ⚠️ `dbutils` context / `spark.databricks.user.name` on the server: returns the
     **notebook owner**, identical for every visitor — usable only as a "running as X"
     label, wrong for "who is viewing".
  - The `X-Forwarded-Email`-family headers are a **Databricks Apps** feature only; the
    driver proxy does not send them.
- **Caveats**: unofficial hosting mode (only Shiny/RStudio are documented); app dies
  with the cluster; server must bind `0.0.0.0`; no per-visitor access token arrives —
  only name/id.

## Case 2 — Databricks Apps

URL shape: `https://<app>-<id>.<region>.databricksapps.com`.

- **AuthN**: fully platform-managed — the Apps reverse proxy runs Databricks OAuth/SSO
  **before** any request reaches the app; the app never implements login
  ([auth docs](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth)).
- **AuthZ**: app permissions `CAN_USE` / `CAN_MANAGE` per user/group.
- **Identity headers** (officially documented:
  [HTTP headers](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/http-headers)):
  `X-Forwarded-Email`, `X-Forwarded-Preferred-Username`, `X-Forwarded-User`,
  `X-Forwarded-Host`, `X-Real-Ip`, `X-Request-Id`. The backend echoes these from
  `/api/me` — the canonical pattern per the official template and the
  [Apps Cookbook](https://apps-cookbook.dev/docs/dash/authentication/users_get_current/).
- **On-behalf-of-user (Public Preview, optional)**: when a workspace admin enables it,
  each request also carries `x-forwarded-access-token` (downscoped OAuth token for the
  visitor). Default scopes always include `iam.current-user:read`, so the backend can
  call SCIM `/Me` as the visitor for richer profile data — **not needed** for
  name/email in the sidebar. Null-check the header; it is absent unless configured.
- **Local dev**: headers are absent locally. `databricks apps run-local` starts a proxy
  that injects them from CLI auth; the official template falls back to SCIM `/Me` via
  CLI OAuth, then a synthetic user. For this repo, the dev mock route can serve a fake
  `/api/me` alongside the mock `/api/chat`.

## Backend shim example (either mode)

```python
@app.get("/api/me")
def me(request: Request):
    h = request.headers
    return {"user": {
        # Databricks Apps
        "email": h.get("x-forwarded-email")
            # driver proxy (community-evidenced)
            or h.get("x-databricks-user-name"),
        "username": h.get("x-forwarded-preferred-username"),
    }}
```

The UI stays UI-only: it never sees a token, never talks to Databricks directly, and
degrades to "no user block" when the endpoint is missing — same failure posture as
`agentsUrl`.
