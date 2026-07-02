"use client";
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  BookOpenIcon, CodeIcon, TerminalIcon, PaintbrushIcon, LockIcon, LayersIcon,
  DownloadIcon, SettingsIcon, ServerIcon, PuzzleIcon, ListTodoIcon, FolderIcon,
  FileTextIcon, FilePenIcon, SearchIcon, SparklesIcon, BrainIcon, ArrowRightIcon
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";
import { TableOfContents } from "./toc";

import { resolveConfig } from "@/lib/config";
import { ChatProvider, useChatContext } from "@/components/chat/chat-provider";
import { ChatScreen } from "@/components/chat/chat-screen";
import { TooltipProvider } from "@/components/ui/tooltip";

const EASE: any = [0.32, 0.72, 0, 1];

export function DocsContent() {
  const reduce = useReducedMotion();

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: EASE }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      }
    }
  };

  const safeFadeUp = reduce ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } } : fadeUp;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-32 relative selection:bg-foreground/10">
      {/* High-end Ambient Background (Ethereal Glass / Soft Structuralism) */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-start justify-center overflow-hidden opacity-30 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] mix-blend-normal" />
        <div className="absolute top-[10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] mix-blend-normal" />
      </div>

      {/* Hero Section */}
      <div className="relative z-10">
        <motion.header
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="py-40 px-6 md:px-12 max-w-[1400px] mx-auto border-b border-border/40 flex flex-col items-center text-center"
        >
          {/* Eyebrow - The "Pill" Tag */}
          <motion.div variants={safeFadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 text-[10px] uppercase tracking-[0.2em] font-medium text-blue-600 dark:text-blue-400 mb-8">
            <BookOpenIcon className="size-3" strokeWidth={1.5} />
            <span>Databricks Agent Interface</span>
          </motion.div>

          <motion.h1
            variants={safeFadeUp}
            className="text-5xl md:text-7xl tracking-tighter leading-[1.05] font-medium max-w-4xl"
          >
            Drop-in Chat UI <br className="hidden md:block" />
            <span className="text-muted-foreground">for Databricks Agents.</span>
          </motion.h1>

          <motion.p
            variants={safeFadeUp}
            className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-[65ch]"
          >
            A reusable, UI-only frontend chat app. One static build serves notebook proxies, Databricks Apps, and manual-copy deployment — no backend, no secrets in the bundle.
          </motion.p>

          <motion.div variants={safeFadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/timezlab/dbx-agent-chat-ui"
              target="_blank"
              rel="noreferrer"
              className="group relative inline-flex items-center justify-between gap-4 pl-6 pr-2 py-2 rounded-full bg-foreground text-background font-medium active:scale-[0.98] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              <div className="flex items-center gap-2">
                <GithubIcon className="size-4" />
                <span>View on GitHub</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-background/20 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-rotate-45 group-hover:bg-background/30">
                <ArrowRightIcon className="size-3.5" strokeWidth={1.5} />
              </div>
            </a>
            <a
              href="#introduction"
              className="inline-flex items-center gap-2 px-5 py-[14px] rounded-full border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors duration-300"
            >
              Read the docs
              <ArrowRightIcon className="size-3.5 rotate-90" strokeWidth={1.5} />
            </a>
          </motion.div>

          {/* Tech stack pills */}
          <motion.div
            variants={safeFadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
          >
            {[
              "Next.js 16",
              "React 19",
              "TypeScript",
              "Tailwind v4",
              "Static Export",
              "shadcn/ui",
              "TanStack Query",
              "SSE Streaming",
            ].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[11px] font-medium tracking-wide bg-muted/40 border border-border/30 text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.header>
      </div>

      {/* Main Content Area */}
      <main className="px-6 md:px-12 max-w-[1400px] mx-auto mt-12 flex flex-col lg:flex-row items-start justify-between gap-12 relative z-10">

        {/* Content Column */}
        <div className="flex-1 min-w-0 w-full max-w-5xl space-y-24">

          <motion.div
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <DocsDemoContainer />
          </motion.div>

          {/* Introduction Section */}
          <motion.section
            id="introduction"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                <SparklesIcon className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Introduction</h2>
            </div>

            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              <strong>dbx-agent-chat-ui</strong> is a reusable, UI-only frontend chat application purpose-built for interacting with Databricks AI Agents.
            </p>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              Instead of building a full-stack monolith, this project focuses strictly on the presentation layer. It generates a single static HTML/JS export that can be hosted anywhere: Notebook proxies, Databricks Apps, or even an S3 bucket.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <DocCard
                icon={<CodeIcon className="size-5" />}
                title="UI-Only Frontier"
                desc="No backend or middleware. It communicates directly via Server-Sent Events (SSE) with your chosen LLM endpoint."
              />
              <DocCard
                icon={<LockIcon className="size-5" />}
                title="Zero Credential Risk"
                desc="Because it's purely static, no secrets or API keys are stored in the bundle, making it inherently secure for enterprise environments."
              />
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Getting Started Section */}
          <motion.section
            id="getting-started"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <TerminalIcon className="size-5 text-muted-foreground" />
              Getting Started
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              The project uses <code>pnpm</code> as the package manager and targets static export for deployment.
            </p>

            <div className="space-y-8 mt-6">
              <div>
                <h3 className="text-lg font-medium tracking-tight mb-3">1. Clone & Install</h3>
                <CodeBlock language="bash">
                  {`git clone https://github.com/timezlab/dbx-agent-chat-ui.git
cd dbx-agent-chat-ui/frontend
pnpm install`}
                </CodeBlock>
              </div>

              <div>
                <h3 className="text-lg font-medium tracking-tight mb-3">2. Run Locally (Dev Mode)</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  The local development environment uses an integrated Mock API route. You only need one terminal.
                </p>
                <CodeBlock title="Terminal" language="bash">
                  {`cd frontend
pnpm dev`}
                </CodeBlock>
              </div>

              <div>
                <h3 className="text-lg font-medium tracking-tight mb-3">3. Production Build</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  To create a static production build, run the appropriate build script:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <CodeBlock title="Manual Build" language="bash">
                    {`cd frontend
pnpm build:manual`}
                  </CodeBlock>
                  <CodeBlock title="Embed Build" language="bash">
                    {`cd frontend
pnpm build:embed`}
                  </CodeBlock>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-4 max-w-[70ch]">
                  The final compiled output will be packaged in the repository root as <code className="bg-muted px-1 rounded text-foreground">manual.zip</code> or <code className="bg-muted px-1 rounded text-foreground">embed.html</code>, ready for deployment.
                </p>
              </div>
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Architecture Section */}
          <motion.section
            id="architecture"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <LayersIcon className="size-5 text-muted-foreground" />
              Architecture & Boundaries
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              This repository provides a reusable chat UI, not a backend runtime. It is designed to deploy to constrained targets (notebooks, proxy hosting) serving only static files, as well as richer wrappers like Databricks Apps. To maintain this flexibility and ensure Databricks secrets never leak to the browser, the repository enforces strict boundaries.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <DocCard
                icon={<TerminalIcon className="size-5" />}
                title="Static Export (D-002)"
                desc="Built with Next.js output: 'export'. No Node.js runtime, route handlers, or server actions are allowed in the shared UI."
              />
              <DocCard
                icon={<CodeIcon className="size-5" />}
                title="UI-Only (D-003)"
                desc="No BFF, API proxy, or credential handling exists here. Data fetching is isolated to client-side adapters."
              />
              <DocCard
                icon={<LockIcon className="size-5" />}
                title="Auth Outside Scope (D-013)"
                desc="Authentication (OAuth, PATs, Service Principals) is strictly handled by the deployment wrapper, never the frontend."
              />
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Configuration Section */}
          <motion.section
            id="configuration"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <SettingsIcon className="size-5 text-muted-foreground" />
              Configuration (Environment Variables)
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              The UI's behavior and endpoint routing are determined purely by public configuration (`NEXT_PUBLIC_*`). Create a `.env` file in the <code>frontend/</code> directory.
            </p>

            <div className="mt-6">
              <CodeBlock
                title="frontend/.env"
                language="env"
                codeString={`# [REQUIRED] Core Chat Endpoint
NEXT_PUBLIC_CHAT_ENDPOINT_URL=/api/chat

# [OPTIONAL] Host-provided REST endpoints
NEXT_PUBLIC_HISTORY_API_URL=/api/history
NEXT_PUBLIC_FEEDBACK_API_URL=/api/feedback
NEXT_PUBLIC_AGENTS_API_URL=/api/agents

# [OPTIONAL] Empty-state sample prompts (JSON Array)
NEXT_PUBLIC_SAMPLE_PROMPTS='["Analyze data", "Write SQL"]'

# [OPTIONAL] Feature Toggles ("1"/"true"/"yes")
NEXT_PUBLIC_ENABLE_UPLOAD=true
NEXT_PUBLIC_DEV_TOOLS=1

# [OPTIONAL] Navigation Links
NEXT_PUBLIC_DOCS_URL=/docs
NEXT_PUBLIC_WELCOME_URL=/welcome`}
              >
                <span className="text-muted-foreground"># [REQUIRED] Core Chat Endpoint</span>
                <br />NEXT_PUBLIC_CHAT_ENDPOINT_URL=/api/chat
                <br /><br /><span className="text-muted-foreground"># [OPTIONAL] Host-provided REST endpoints</span>
                <br />NEXT_PUBLIC_HISTORY_API_URL=/api/history
                <br />NEXT_PUBLIC_FEEDBACK_API_URL=/api/feedback
                <br />NEXT_PUBLIC_AGENTS_API_URL=/api/agents
                <br /><br /><span className="text-muted-foreground"># [OPTIONAL] Empty-state sample prompts (JSON Array)</span>
                <br />NEXT_PUBLIC_SAMPLE_PROMPTS='["Analyze data", "Write SQL"]'
                <br /><br /><span className="text-muted-foreground"># [OPTIONAL] Feature Toggles ("1"/"true"/"yes")</span>
                <br />NEXT_PUBLIC_ENABLE_UPLOAD=true
                <br />NEXT_PUBLIC_DEV_TOOLS=1
                <br /><br /><span className="text-muted-foreground"># [OPTIONAL] Navigation Links</span>
                <br />NEXT_PUBLIC_DOCS_URL=/docs
                <br />NEXT_PUBLIC_WELCOME_URL=/welcome
              </CodeBlock>
            </div>

            <ul className="space-y-3 mt-6 text-sm text-muted-foreground max-w-[70ch] list-disc list-outside pl-4">
              <li><strong>Zero-Databricks Dev:</strong> Local development uses <code className="text-foreground bg-muted/50 px-1.5 py-0.5 rounded">/api/chat</code> (or <code>http://localhost:3000/api/chat</code>) to hit the internal mock API route.</li>
              <li><strong>Graceful Degradation:</strong> If the History API fails or is unset, the UI falls back to <code className="text-foreground bg-muted/50 px-1.5 py-0.5 rounded">localStorage</code>.</li>
            </ul>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Transport & Streaming Section */}
          <motion.section
            id="transport"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <CodeIcon className="size-5 text-muted-foreground" />
              Chat Transport & Streaming
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              The UI talks to Databricks agent endpoints using a single transport abstraction. There are no transport "modes"; the UI streams from one endpoint speaking the Databricks Playground SSE format.
            </p>

            <div className="space-y-6 mt-6">
              <div className="p-5 rounded-2xl border border-border/50 bg-card hover:bg-muted/10 transition-colors">
                <h4 className="font-medium tracking-tight text-foreground mb-2">Streaming via Fetch-Event-Source</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We use <code className="text-foreground bg-muted/50 px-1 rounded">@microsoft/fetch-event-source</code> to support POST SSE, custom headers, and request bodies. The stream reducer handles optimistic updates, parses tool timelines, and manages stream abortion natively.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border/50 bg-card hover:bg-muted/10 transition-colors">
                <h4 className="font-medium tracking-tight text-foreground mb-2 flex items-center gap-2">
                  <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                  Auto-Retry Connection Recovery
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  To handle transient network drops or proxy timeouts (like FastAPI's aggressive keep-alive limits), the transport includes an auto-retry mechanism. It will silently attempt to reconnect up to <strong>3 times</strong> (with a 2s delay) upon unexpected disconnects before surfacing an error to the user.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  <strong>Backend Integration:</strong> To support seamless resumption, your backend must include an <code>id</code> field in its SSE events (e.g., <code>id: msg_123</code>). During a retry, the UI automatically re-sends the original POST request along with a <code>Last-Event-ID</code> header containing the last received ID. Your backend should parse this header and resume the stream from that point rather than restarting the generation.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border/50 bg-card hover:bg-muted/10 transition-colors">
                <h4 className="font-medium tracking-tight text-foreground mb-2">Markdown & Code via Streamdown</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Assistant replies are rendered using <code className="text-foreground bg-muted/50 px-1 rounded">streamdown</code>, transforming markdown, code blocks, and tables into structured UI. Tool calls and traces are intercepted and rendered as distinct Timeline components rather than raw markdown.
                </p>
              </div>
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Dev Tools Section */}
          <motion.section
            id="dev-tools"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <SettingsIcon className="size-5 text-muted-foreground" />
              Dev Tools
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              The UI includes built-in developer utilities for UI styling and integration testing without requiring a real backend.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <DocCard
                icon={<SettingsIcon className="size-5" />}
                title="Dev Tools & Replay Mode"
                desc="Set NEXT_PUBLIC_DEV_TOOLS=1. A Flask icon in the sidebar lets you toggle 'Replay Mode' to play recorded SSE streams client-side (no backend needed), perfect for UI testing."
              />
              <DocCard
                icon={<BookOpenIcon className="size-5" />}
                title="Test Toasts"
                desc="The Dev Tools menu also includes buttons to trigger sample persistent error toasts, helping you verify that stream failure scenarios render correctly without forcing a backend failure."
              />
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Tool Rendering & Skills Section */}
          <motion.section
            id="builtin-tools"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <LayersIcon className="size-5 text-muted-foreground" />
              Tool Rendering & Skills
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              The UI natively parses and renders Markdown, tables, and code blocks using <code className="text-foreground bg-muted/50 px-1 rounded">streamdown</code>. Arbitrary function calls from the backend are automatically intercepted and rendered as Timeline blocks without custom component registration.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">
              While any generic tool call is rendered using a standard wrench icon, the UI includes bespoke, humanized templates for the following built-in tools:
            </p>
            <div className="space-y-4 mt-6">
              <ToolSpecCard
                name="write_todos"
                icon={<ListTodoIcon className="size-3.5" />}
                title="Create plan"
                schema={`{
  "todos": [
    "<string>"
  ]
}`}
                example={`{
  "type": "function_call",
  "name": "write_todos",
  "arguments": "{\\"todos\\": [\\"Setup DB\\"]}"
}`}
              />
              <ToolSpecCard
                name="execute"
                icon={<TerminalIcon className="size-3.5" />}
                title="Run"
                schema={`{
  "command": "<string>"
}`}
                example={`{
  "type": "function_call",
  "name": "execute",
  "arguments": "{\\"command\\": \\"npm run build\\"}"
}`}
              />
              <ToolSpecCard
                name="read_file"
                icon={<FileTextIcon className="size-3.5" />}
                title="Read"
                schema={`{
  "file_path": "<string>",
  "offset": "<number>",
  "limit": "<number>"
}`}
                example={`{
  "type": "function_call",
  "name": "read_file",
  "arguments": "{\\"file_path\\": \\"src/main.ts\\", \\"offset\\": 0, \\"limit\\": 100}"
}`}
              />
              <ToolSpecCard
                name="write_file (or edit_file)"
                icon={<FilePenIcon className="size-3.5" />}
                title="Write"
                schema={`{
  "file_path": "<string>",
  "content": "<string>"
}`}
                example={`{
  "type": "function_call",
  "name": "write_file",
  "arguments": "{\\"file_path\\": \\"config.json\\", \\"content\\": \\"{}\\"}"
}`}
              />
              <ToolSpecCard
                name="grep (or glob)"
                icon={<SearchIcon className="size-3.5" />}
                title="Search"
                schema={`{
  "pattern": "<string>"
}`}
                example={`{
  "type": "function_call",
  "name": "grep",
  "arguments": "{\\"pattern\\": \\"TODO:\\"}"
}`}
              />
              <ToolSpecCard
                name="task"
                icon={<SparklesIcon className="size-3.5" />}
                title="Delegate"
                schema={`{
  "description": "<string>"
}`}
                example={`{
  "type": "function_call",
  "name": "task",
  "arguments": "{\\"description\\": \\"Fix styling\\"}"
}`}
              />
              <ToolSpecCard
                name="compact_conversation"
                icon={<BrainIcon className="size-3.5" />}
                title="Compact conversation"
                schema={`// 1. Tool Call Args
{}

// 2. Tool Result Output
{
  "summary": "<string>",
  "messagesBefore": "<number>",
  "messagesAfter": "<number>"
}`}
                example={`// 1. Tool Call Event
{
  "type": "function_call",
  "name": "compact_conversation",
  "arguments": "{}"
}

// 2. Tool Result Event
{
  "type": "function_call_output",
  "name": "compact_conversation",
  "output": "{\\"summary\\": \\"Trims text\\", \\"messagesBefore\\": 20, \\"messagesAfter\\": 5}"
}`}
              />
            </div>

            <div className="p-4 rounded-xl border border-border/50 bg-muted/20">
              <h4 className="font-medium text-foreground mb-2 text-sm">Special Case: Skills</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If the agent calls <code>read_file</code> and the target path matches the <code>/skills/&lt;name&gt;/...</code> pattern, the UI recognizes this as a skill activation. Instead of rendering a dry "Read" action, it renders a Puzzle icon titled <strong>"Skill"</strong> and extracts the skill's name (e.g. "report-builder") as the subtitle.
              </p>
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Backend Integration Guide Section */}
          <motion.section
            id="backend-integration"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <ServerIcon className="size-5 text-muted-foreground" />
              Backend Integration Guide
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              To build a backend compatible with this UI, you need to expose a <code>POST</code> endpoint (configured via <code>NEXT_PUBLIC_CHAT_ENDPOINT_URL</code>). The endpoint must return a Server-Sent Events (SSE) stream adhering to the <strong>Databricks Playground / MLflow Responses format</strong>.
            </p>

            <div className="space-y-8 mt-6">
              <div>
                <h3 className="text-lg font-medium tracking-tight mb-3">1. Event Data Types</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Your SSE stream should send JSON payloads in the <code>data:</code> field with specific <code>type</code> values. The UI's parser specifically listens for the following events:
                </p>
                <ul className="space-y-3 mt-4 text-sm text-muted-foreground max-w-[70ch] list-disc list-outside pl-4">
                  <li><strong>Text Tokens:</strong> <code>{`{"type": "response.output_text.delta", "delta": "Hello"}`}</code></li>
                  <li><strong>Reasoning Tokens (Optional):</strong> <code>{`{"type": "response.reasoning_text.delta", "delta": "Let me think..."}`}</code></li>
                  <li><strong>Tool Call Start:</strong> <code>{`{"type": "response.output_item.done", "item": {"type": "function_call", "call_id": "call_123", "name": "search", "arguments": "{}"}}`}</code></li>
                  <li><strong>Tool Call Result:</strong> <code>{`{"type": "response.output_item.done", "item": {"type": "function_call_output", "call_id": "call_123", "output": "Result string"}}`}</code></li>
                  <li><strong>Error Handling:</strong> Send <code>{`{"error": "Message"}`}</code> on the final frame before closing.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium tracking-tight mb-3">2. Generating SSE from an LLM & Auto-Retry</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  To support the UI's auto-reconnect feature, every SSE event must include an <code>id</code> field. When reconnecting, the UI sends the <code>Last-Event-ID</code> header. If you are proxying Databricks Model Serving, Databricks natively emits these IDs and buffers the stream. If you are building your own LLM integration, you must include an <code>id</code> and ideally buffer the stream (e.g. in Redis) to resume properly.
                </p>
                <CodeBlock title="Realistic LLM Backend Example (FastAPI)" language="python">
                  {`from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json
import asyncio

app = FastAPI()

# In-memory buffer for demonstration. In production, use Redis/DB.
# Structure: { "session_123": [{"payload": {...}}, ...] }
STREAM_BUFFER = {}
# Track active streams to know when to stop tailing
ACTIVE_STREAMS = set()

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    # 1. Read Last-Event-ID to know where the client left off
    last_event_id = request.headers.get("Last-Event-ID")
    body = await request.json()
    session_id = body.get("session_id", "default")
    
    if session_id not in STREAM_BUFFER:
        STREAM_BUFFER[session_id] = []

    async def event_generator():
        buffered = STREAM_BUFFER[session_id]
        
        # 2. Reconnection Flow: tail the buffer in O(1) using the index
        if last_event_id and last_event_id.isdigit():
            # If SSE 'id' is the index, we jump directly to the next item
            current_idx = int(last_event_id) + 1
            
            while current_idx < len(buffered) or session_id in ACTIVE_STREAMS:
                if current_idx < len(buffered):
                    chunk = buffered[current_idx]
                    if chunk["payload"] is None:
                        yield "data: [DONE]\\n\\n"
                        return
                    yield f"id: {current_idx}\\ndata: {json.dumps(chunk['payload'])}\\n\\n"
                    current_idx += 1
                else:
                    await asyncio.sleep(0.1)
            
            yield "data: [DONE]\\n\\n"
            return

        # 3. Normal Flow: Streaming from an LLM provider
        ACTIVE_STREAMS.add(session_id)
        try:
            llm_stream = await llm_client.chat.completions.create(
                messages=body.get("messages", []),
                stream=True
            )
            
            async for chunk in llm_stream:
                payload = {
                    "type": "response.output_text.delta",
                    "delta": chunk.choices[0].delta.content or ""
                }
                
                # 4. Buffer chunk and use array length as the SSE \`id\`
                idx = len(buffered)
                buffered.append({"payload": payload})
                
                # 5. Yield standard SSE format WITH integer \`id\`
                yield f"id: {idx}\\ndata: {json.dumps(payload)}\\n\\n"
                
            # Push DONE marker
            buffered.append({"payload": None})
            yield "data: [DONE]\\n\\n"
        finally:
            ACTIVE_STREAMS.discard(session_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")`}
                </CodeBlock>
              </div>
            </div>
          </motion.section>

          <div className="h-px w-full bg-border/40" />

          {/* Customization & Theming Section */}
          <motion.section
            id="customization"
            className="space-y-6 scroll-mt-24"
            initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl font-medium tracking-tight flex items-center gap-2">
              <PaintbrushIcon className="size-5 text-muted-foreground" />
              Customization & Theming
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-[70ch]">
              The UI is built to be re-skinned by consumers without forking. Customization is supported via three primary pillars:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <DocCard
                icon={<div className="size-3 rounded-full bg-foreground" />}
                title="CSS Variables"
                desc="All visual tokens (colors, radius, typography) map to CSS variables in globals.css."
              />
              <DocCard
                icon={<div className="size-3 rounded-full border-2 border-muted-foreground" />}
                title="Class Overrides"
                desc="Every component forwards className and merges it via cn(), allowing external styling overrides."
              />
            </div>
          </motion.section>

        </div>

        {/* Sticky Table of Contents */}
        <div className="hidden lg:block w-56 shrink-0 sticky top-24">
          <TableOfContents />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-24 border-t border-border/40 px-6 md:px-12 max-w-[1400px] mx-auto py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="size-4 text-blue-500/70" strokeWidth={1.5} />
            <span>
              <span className="font-medium text-foreground">dbx-agent-chat-ui</span>
              {" — "}reusable chat UI for Databricks Agents
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/timezlab/dbx-agent-chat-ui"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GithubIcon className="size-4" />
              <span>GitHub</span>
            </a>
            <span className="text-border/60">·</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DocCard({ icon, title, desc, href }: { icon: React.ReactNode; title: string; desc: string; href?: string }) {
  const content = (
    <>
      <div className="size-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-foreground border border-black/5 dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
        {icon}
      </div>
      <div>
        <h4 className="font-medium tracking-tight text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{desc}</p>
      </div>
    </>
  );

  const className = "group flex flex-col gap-3 p-5 rounded-[2rem] border border-border/20 bg-card/40 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-muted/10 transition-colors relative z-10" + (href ? " cursor-pointer" : "");

  const motionProps = {};

  if (href) {
    return <motion.a href={href} className={className} {...motionProps}>{content}</motion.a>;
  }
  return <motion.div className={className} {...motionProps}>{content}</motion.div>;
}

function ToolSpecCard({ name, icon, title, schema, example }: { name: string; icon: React.ReactNode; title: string; schema: string; example: string }) {
  return (
    <motion.div
      className="p-4 rounded-[1.5rem] border border-border/20 bg-card/40 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] space-y-3 hover:bg-muted/10 transition-colors"
    >
      <div className="flex items-center justify-between">
        <code className="text-xs font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-lg border border-black/5 dark:border-white/5 text-foreground">{name}</code>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5 px-2.5 py-1 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
          {icon}
          <span>{title}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Expected Arguments</span>
          <CodeBlock language="json" className="!my-0 flex-1 rounded-xl shadow-none">
            {schema}
          </CodeBlock>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">Example SSE Payload</span>
          <CodeBlock language="json" className="!my-0 flex-1 rounded-xl shadow-none">
            {example}
          </CodeBlock>
        </div>
      </div>
    </motion.div>
  );
}

function DocsDemoContainer() {
  const config = React.useMemo(() => resolveConfig(), []);
  return (
    <div className="mx-auto w-full rounded-[1.25rem] border border-black/10 dark:border-white/10 bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden flex flex-col h-[650px] relative">
      {/* Mac window header */}
      <div className="flex items-center px-4 py-3 bg-muted/20 border-b border-border/40 relative z-20">
        <div className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-muted-foreground">Interactive Demo (Replay Mode)</span>
        </div>
      </div>
      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative z-10 bg-background/50">
        <ChatProvider config={config}>
          <DemoAutomator />
          <TooltipProvider>
            <ChatScreen className="absolute inset-0" />
          </TooltipProvider>
        </ChatProvider>
      </div>
    </div>
  );
}

function DemoAutomator() {
  const {
    replayMode,
    toggleReplayMode,
    replaySession,
    replayPlay,
    status,
    messages
  } = useChatContext();

  const isGenerating = status === "streaming";

  React.useEffect(() => {
    // 1. Ensure we are in Replay Mode
    if (!replayMode) {
      // Using a small timeout avoids React warning about updating state during render
      const t = setTimeout(() => toggleReplayMode(), 100);
      return () => clearTimeout(t);
    }

    // 2. Start playback when empty and ready
    if (messages.length === 0 && replaySession.status === "idle" && !isGenerating) {
      const t = setTimeout(() => {
        replayPlay();
      }, 1000);
      return () => clearTimeout(t);
    }

    // 3. When finished, wait 15 seconds, then reset by turning off (which triggers step 1)
    if (messages.length > 0 && !isGenerating && replaySession.status === "idle") {
      const t = setTimeout(() => {
        toggleReplayMode();
      }, 15000); // 15s sleep
      return () => clearTimeout(t);
    }
  }, [replayMode, isGenerating, messages.length, replaySession.status, toggleReplayMode, replayPlay]);

  return null;
}

