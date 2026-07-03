"use client";

import * as React from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileCode2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Highlight, themes, type Language } from "prism-react-renderer";
import { useTheme } from "next-themes";

// Matches the code area's font metrics: text-[13px] * leading-[1.7].
const LINE_HEIGHT_PX = 13 * 1.7;

const HIGHLIGHT_LANGUAGES = [
  "bash",
  "python",
  "json",
  "typescript",
  "javascript",
  "jsx",
  "tsx",
  "css",
  "html",
];

function toPrismLanguage(language?: string): Language {
  if (!language) return "text" as Language;
  // .env files highlight well enough with the bash grammar (# comments, KEY=value).
  if (language === "env") return "bash" as Language;
  return (
    HIGHLIGHT_LANGUAGES.includes(language) ? language : "text"
  ) as Language;
}

export function CodeBlock({
  title,
  language,
  children,
  codeString,
  compact = false,
  wrap = false,
  collapsible = false,
  previewLines = 8,
  className,
}: {
  title?: string;
  language?: string;
  children: React.ReactNode;
  codeString?: string;
  /** Headerless variant for tight layouts (copy button floats over the code). */
  compact?: boolean;
  /** Wrap long lines instead of scrolling horizontally (good for JSON payloads). */
  wrap?: boolean;
  /** Clip to `previewLines` with an expand toggle for long snippets. */
  collapsible?: boolean;
  previewLines?: number;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === "dark";
  const rawCode = codeString || (typeof children === "string" ? children : "");

  const totalLines = rawCode ? rawCode.trim().split("\n").length : 0;
  // Only actually collapse when there's enough hidden content to be worth it.
  const canCollapse = collapsible && totalLines > previewLines + 2;
  const isClipped = canCollapse && !expanded;

  const handleCopy = () => {
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyButton = (
    <button
      onClick={handleCopy}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95",
        compact &&
          "absolute right-2 top-2 z-10 border border-border/60 bg-card opacity-0 group-hover:opacity-100"
      )}
      aria-label="Copy code"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );

  return (
    <div
      className={cn(
        "group relative my-6 overflow-hidden rounded-2xl border border-border/60 bg-card dark:bg-black/20",
        className
      )}
    >
      {compact ? (
        copyButton
      ) : (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileCode2Icon className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate">{title ?? language ?? "code"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {language && title && (
              <span className="rounded-md border border-border/60 bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {language}
              </span>
            )}
            {copyButton}
          </div>
        </div>
      )}

      <div className="relative">
        <div
          className={cn(
            "font-mono text-[13px] leading-[1.7] selection:bg-primary/15",
            wrap ? "overflow-x-hidden" : "overflow-x-auto",
            compact ? "p-4" : "p-5"
          )}
          style={
            isClipped
              ? {
                  maxHeight: `${previewLines * LINE_HEIGHT_PX + (compact ? 32 : 40)}px`,
                  overflowY: "hidden",
                }
              : undefined
          }
        >
          {rawCode ? (
            <Highlight
              theme={isDark ? themes.vsDark : themes.github}
              code={rawCode.trim()}
              language={toPrismLanguage(language)}
            >
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  className={className}
                  style={{
                    ...style,
                    backgroundColor: "transparent",
                    ...(wrap
                      ? {
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }
                      : {}),
                  }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          ) : (
            <pre className="text-foreground/80">
              <code>{children}</code>
            </pre>
          )}
        </div>

        {isClipped && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-card to-transparent dark:from-[#0a0a0a]" />
        )}
      </div>

      {canCollapse && (
        <div
          className={cn(
            "flex justify-center border-t px-4 py-2",
            isClipped ? "border-transparent" : "border-border/60"
          )}
        >
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? "Collapse" : `Expand (${totalLines} lines)`}
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform duration-300",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>
      )}
    </div>
  );
}
