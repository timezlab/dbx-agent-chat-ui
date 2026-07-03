import * as React from "react";

/** Compact key/value list for scalar / short-string args. */
export function ArgList({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="font-mono text-muted-foreground">{key}</dt>
          <dd className="min-w-0 font-mono wrap-break-word text-foreground/80">
            {value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** A labeled, scrollable block for long text — file contents, command output, etc. */
export function LabeledBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-56 overflow-auto rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] leading-tight whitespace-pre-wrap wrap-break-word">
        {text}
      </pre>
    </div>
  );
}
