"use client";

import * as React from "react";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";

import type { Agent, Todo } from "@/entities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isBlank } from "@/lib/chat/queue";
import { TodoCard } from "./todo-card";

export interface ChatComposerProps
  extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  /** Dispatch the typed text. Blank input is ignored here and by the hook (FR-002). */
  onSend: (text: string) => void;
  /** Abort the active generation. The stop affordance shows only while `busy` (US2). */
  onCancel?: () => void;
  /** The agent's current plan; rendered as an expandable strip ON the input card. */
  todos?: Todo[];
  /** True while a generation streams — a further send queues behind it (FR-007). */
  busy?: boolean;
  /** Hard-disable input (e.g. no chat endpoint configured, T055). */
  disabled?: boolean;
  placeholder?: string;
  /** Selectable agents for the toolbar dropdown (US5). Empty ⇒ no dropdown. */
  agents?: Agent[];
  /** Currently selected agent id. */
  selectedAgentId?: string | null;
  /** Choose an agent from the dropdown. */
  onSelectAgent?: (id: string) => void;
  /** Whether to render the agent dropdown (agents configured + non-empty, FR-026). */
  agentsAvailable?: boolean;
  /** Show the attach/upload affordance (env-gated, default off; upload deferred). */
  uploadEnabled?: boolean;
}

/**
 * Message composer: an input pill with the agent's todo plan docked flush on top
 * (expandable) and a textarea + send control below. Enter sends (Shift+Enter =
 * newline). Blank/whitespace is rejected (no empty bubble, no request). While
 * `busy`, sending still queues — the affordance signals the queued state.
 */
export function ChatComposer({
  onSend,
  onCancel,
  todos = [],
  busy = false,
  disabled = false,
  placeholder = "Send a message…",
  agents = [],
  selectedAgentId = null,
  onSelectAgent,
  agentsAvailable = false,
  uploadEnabled = false,
  className,
  ...props
}: ChatComposerProps) {
  const [text, setText] = React.useState("");
  const canSend = !disabled && !isBlank(text);
  // While streaming with an empty composer, the action button becomes Stop.
  // Start typing to queue another message (Send takes over). Stop only appears
  // while busy, so the cancel affordance is offered exactly when it applies (US2).
  const showStop = busy && isBlank(text) && onCancel != null;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      data-slot="chat-composer"
      className={cn(
        "flex flex-col rounded-2xl border border-input bg-background shadow-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      {...props}
    >
      {todos.length > 0 ? (
        <TodoCard
          todos={todos}
          className="rounded-none rounded-t-2xl border-0 border-b bg-transparent"
        />
      ) : null}

      <div className="px-2 pt-2">
        <Textarea
          data-slot="chat-composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          aria-label="Message"
          className="max-h-48 min-h-9 resize-none border-0 bg-transparent px-1.5 py-1.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
      </div>

      {/* Toolbar under the textarea (AI-platform layout): left = attach, right = agent picker + send/stop. */}
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <UploadButton enabled={uploadEnabled} disabled={disabled} />
        </div>

        <div className="flex items-center gap-1.5">
          <Select
            value={selectedAgentId ?? (agents.length > 0 ? undefined : "default")}
            onValueChange={(v) => onSelectAgent?.(v)}
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              data-slot="chat-composer-agent"
              aria-label="Select agent"
              className="h-8 min-w-0 gap-1.5 rounded-lg border-none bg-muted/60 text-xs shadow-none hover:bg-muted focus-visible:ring-2"
            >
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.length > 0 ? (
                agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id} className="text-xs">
                    {agent.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="default" className="text-xs">
                  Agent
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {showStop ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => onCancel?.()}
              data-slot="chat-composer-stop"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <SquareIcon className="fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              data-slot="chat-composer-send"
              aria-label={busy ? "Queue message" : "Send message"}
              title={busy ? "Queue message" : "Send message"}
            >
              <ArrowUpIcon />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

/**
 * The attach affordance. Gated by `NEXT_PUBLIC_ENABLE_UPLOAD` (env → `enabled`): off by
 * default, it renders dimmed + disabled with an explanatory tooltip. When enabled it
 * opens a native file picker, but upload is still deferred (D-014) — the selected file
 * is intentionally not processed yet; this is the UI seam for the future feature.
 */
function UploadButton({
  enabled,
  disabled,
}: {
  enabled: boolean;
  disabled: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Wrap so the tooltip still fires while the button is disabled. */}
        <span className="inline-flex">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            disabled={disabled || !enabled}
            onClick={() => inputRef.current?.click()}
            data-slot="chat-composer-upload"
            aria-label="Attach files"
          >
            <PaperclipIcon />
          </Button>
          {enabled ? (
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              // Upload is deferred (D-014): capture the pick but do nothing yet.
              onChange={(e) => {
                e.currentTarget.value = "";
              }}
            />
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? "Attach files" : "Attachments are disabled"}
      </TooltipContent>
    </Tooltip>
  );
}

export default ChatComposer;
