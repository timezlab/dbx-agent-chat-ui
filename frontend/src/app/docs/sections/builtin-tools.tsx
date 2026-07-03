"use client";

import * as React from "react";
import {
  BrainIcon,
  DatabaseIcon,
  FilePenIcon,
  FileTextIcon,
  GlobeIcon,
  LibraryBigIcon,
  LinkIcon,
  ListTodoIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { CodeBlock } from "../code-block";
import { Callout, DocsSection, InlineCode, SectionLead } from "../components";

const BUILTIN_TOOLS = [
  {
    name: "write_todos",
    icon: <ListTodoIcon className="size-3.5" />,
    title: "Create plan",
    schema: `{
  "todos": [
    "<string>"
  ]
}`,
    example: `{
  "type": "function_call",
  "name": "write_todos",
  "arguments": "{\\"todos\\": [\\"Setup DB\\"]}"
}`,
  },
  {
    name: "execute",
    icon: <TerminalIcon className="size-3.5" />,
    title: "Run",
    schema: `{
  "command": "<string>"
}`,
    example: `{
  "type": "function_call",
  "name": "execute",
  "arguments": "{\\"command\\": \\"npm run build\\"}"
}`,
  },
  {
    name: "read_file",
    icon: <FileTextIcon className="size-3.5" />,
    title: "Read",
    schema: `{
  "file_path": "<string>",
  "offset": "<number>",
  "limit": "<number>"
}`,
    example: `{
  "type": "function_call",
  "name": "read_file",
  "arguments": "{\\"file_path\\": \\"src/main.ts\\", \\"offset\\": 0, \\"limit\\": 100}"
}`,
  },
  {
    name: "write_file (or edit_file)",
    icon: <FilePenIcon className="size-3.5" />,
    title: "Write",
    schema: `{
  "file_path": "<string>",
  "content": "<string>"
}`,
    example: `{
  "type": "function_call",
  "name": "write_file",
  "arguments": "{\\"file_path\\": \\"config.json\\", \\"content\\": \\"{}\\"}"
}`,
  },
  {
    name: "grep (or glob)",
    icon: <SearchIcon className="size-3.5" />,
    title: "Search",
    schema: `{
  "pattern": "<string>"
}`,
    example: `{
  "type": "function_call",
  "name": "grep",
  "arguments": "{\\"pattern\\": \\"TODO:\\"}"
}`,
  },
  {
    name: "task",
    icon: <SparklesIcon className="size-3.5" />,
    title: "Delegate",
    schema: `{
  "description": "<string>"
}`,
    example: `{
  "type": "function_call",
  "name": "task",
  "arguments": "{\\"description\\": \\"Fix styling\\"}"
}`,
  },
  {
    name: "web_search",
    icon: <GlobeIcon className="size-3.5" />,
    title: "Search web",
    schema: `// 1. Tool Call Args
{
  "query": "<string>",
  "max_results": "<number>",
  "sources": ["<string>"],
  "location": "<string>",
  "start_date": "<string>",
  "end_date": "<string>"
}

// 2. Tool Result Output — array of sources
[
  { "url": "<string>", "title": "<string>", "preview": "<string>" }
]`,
    example: `// 1. Tool Call Event
{
  "type": "function_call",
  "name": "web_search",
  "arguments": "{\\"query\\": \\"SaaS market 2026\\", \\"sources\\": [\\"news\\"]}"
}

// 2. Tool Result Event (rendered as source cards)
{
  "type": "function_call_output",
  "name": "web_search",
  "output": "[{\\"url\\": \\"https://example.com\\", \\"preview\\": \\"...\\"}]"
}`,
  },
  {
    name: "execute_sql",
    icon: <DatabaseIcon className="size-3.5" />,
    title: "Query",
    schema: `// 1. Tool Call Args
{
  "query": "<string>",
  "warehouse": "<string>",
  "catalog": "<string>",
  "schema": "<string>",
  "limit": "<number>"
}

// 2. Tool Result Output — a table
{
  "columns": ["<string>"],
  "rows": [["<cell>"]],
  "row_count": "<number>"
}`,
    example: `{
  "type": "function_call",
  "name": "execute_sql",
  "arguments": "{\\"query\\": \\"SELECT metric, actual_ytd FROM finance.pnl\\"}"
}`,
  },
  {
    name: "vector_search",
    icon: <LibraryBigIcon className="size-3.5" />,
    title: "Retrieve",
    schema: `// 1. Tool Call Args
{
  "query": "<string>",
  "num_results": "<number>",
  "index": "<string>",
  "columns": ["<string>"]
}

// 2. Tool Result Output — array of chunks
[
  { "content": "<string>", "source": "<string>", "score": "<number>" }
]`,
    example: `{
  "type": "function_call",
  "name": "vector_search",
  "arguments": "{\\"query\\": \\"revenue recognition policy\\", \\"num_results\\": 3}"
}`,
  },
  {
    name: "web_fetch",
    icon: <LinkIcon className="size-3.5" />,
    title: "Fetch",
    schema: `{
  "url": "<string>",
  "max_length": "<number>",
  "format": "<string>"
}`,
    example: `{
  "type": "function_call",
  "name": "web_fetch",
  "arguments": "{\\"url\\": \\"https://example.com\\", \\"format\\": \\"markdown\\"}"
}`,
  },
  {
    name: "compact_conversation",
    icon: <BrainIcon className="size-3.5" />,
    title: "Compact conversation",
    schema: `// 1. Tool Call Args
{}

// 2. Tool Result Output
{
  "summary": "<string>",
  "messagesBefore": "<number>",
  "messagesAfter": "<number>"
}`,
    example: `// 1. Tool Call Event
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
}`,
  },
];

export function BuiltinToolsSection() {
  return (
    <DocsSection
      id="builtin-tools"
      icon={<WrenchIcon className="size-4" />}
      title="Tool Rendering & Skills"
    >
      <SectionLead>
        The UI natively parses and renders Markdown, tables, and code blocks
        using <InlineCode>streamdown</InlineCode>. Arbitrary function calls
        from the backend are automatically intercepted and rendered as
        Timeline blocks without custom component registration.
      </SectionLead>
      <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        While any generic tool call is rendered using a standard wrench icon,
        the UI includes bespoke, humanized templates for the following
        built-in tools:
      </p>

      <div className="mt-6 space-y-4">
        {BUILTIN_TOOLS.map((tool) => (
          <ToolSpecCard key={tool.name} {...tool} />
        ))}
      </div>

      <Callout title="Special Case: Skills">
        If the agent calls <InlineCode>read_file</InlineCode> and the target
        path matches the <InlineCode>/skills/&lt;name&gt;/...</InlineCode>{" "}
        pattern, the UI recognizes this as a skill activation. Instead of
        rendering a dry &quot;Read&quot; action, it renders a Puzzle icon
        titled <strong className="text-foreground">&quot;Skill&quot;</strong>{" "}
        and extracts the skill&apos;s name (e.g. &quot;report-builder&quot;)
        as the subtitle.
      </Callout>
    </DocsSection>
  );
}

function ToolSpecCard({
  name,
  icon,
  title,
  schema,
  example,
}: {
  name: string;
  icon: React.ReactNode;
  title: string;
  schema: string;
  example: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-center justify-between gap-3">
        <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
          {name}
        </code>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {icon}
          <span>{title}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">
            Expected arguments
          </span>
          <CodeBlock language="json" compact className="!my-0 flex-1">
            {schema}
          </CodeBlock>
        </div>
        <div className="flex flex-col">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">
            Example SSE payload
          </span>
          <CodeBlock language="json" compact className="!my-0 flex-1">
            {example}
          </CodeBlock>
        </div>
      </div>
    </div>
  );
}
