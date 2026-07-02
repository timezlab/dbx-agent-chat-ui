"use client";

import * as React from "react";
import { BookOpenIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons/github";

export function DocsFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-border/60">
      <div className="mx-auto max-w-350 px-6 py-10 md:px-12">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="size-4 text-primary" strokeWidth={1.5} />
            <span>
              <span className="font-medium text-foreground">
                dbx-agent-chat-ui
              </span>
              , a reusable chat UI for Databricks Agents
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/timezlab/dbx-agent-chat-ui"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <GithubIcon className="size-4" />
              <span>GitHub</span>
            </a>
            <span className="text-border">·</span>
            <span>MIT License</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
