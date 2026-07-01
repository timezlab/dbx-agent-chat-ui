# dbx-agent-chat-ui web (Next.js) — dev-mode container behind the timezlab tunnel.
# UI-only: no backend, no secrets baked in (only NEXT_PUBLIC_* reach the browser).
# For a Databricks/static deploy, use `pnpm build` (static export to out/) instead —
# this image exists to serve the app on the shared Cloudflare tunnel.
# Node 22 to match the Databricks Apps target (constitution: Node.js 22.16).
FROM node:22-bookworm-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "exec", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]
