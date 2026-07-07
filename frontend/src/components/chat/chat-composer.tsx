"use client";

import * as React from "react";
import { ArrowUpIcon, PaperclipIcon, SquareIcon, XIcon } from "lucide-react";

import type { Agent, Attachment, Todo } from "@/entities";
import { cn } from "@/lib/utils";
import { validateAttachment } from "@/lib/chat/attachments";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isBlank } from "@/lib/chat/queue";
import type { ContextUsage } from "@/lib/chat/metrics";
import { ContextMeter } from "./context-meter";
import { TodoCard } from "./todo-card";

export interface ChatComposerProps
  extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  /** Dispatch the typed text (+ any attached files, T071). Blank input is ignored
   *  here and by the hook (FR-002) — attachments alone never trigger a send. */
  onSend: (text: string, attachments: Attachment[]) => void;
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
  /** Show the attach/upload affordance (env-gated, default off). */
  uploadEnabled?: boolean;
  /** File-picker accept list (mime patterns/extensions, comma-separated, T071). */
  uploadAccept?: string;
  /** Max size per attached file, in bytes (T071). */
  uploadMaxSizeBytes?: number;
  /** Whether the usage surface is enabled — gates the context-window meter (004). */
  usageEnabled?: boolean;
  /** Current context-window occupancy for the toolbar meter (004). */
  contextUsage?: ContextUsage;
}

function generateAttachmentId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `att-${Math.random().toString(36).slice(2)}`
  );
}

/** Read a `File` into a base64 data URL — client-side only, no backend (T071). */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  uploadAccept,
  uploadMaxSizeBytes,
  usageEnabled = false,
  contextUsage,
  className,
  ...props
}: ChatComposerProps) {
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounter = React.useRef(0);

  const canSend = !disabled && !isBlank(text);
  // While streaming with an empty composer, the action button becomes Stop.
  // Start typing to queue another message (Send takes over). Stop only appears
  // while busy, so the cancel affordance is offered exactly when it applies (US2).
  const showStop = busy && isBlank(text) && onCancel != null;

  const submit = () => {
    if (!canSend) return;
    onSend(text, attachments);
    setText("");
    setAttachments([]);
    setAttachError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const handleFilesPicked = async (files: FileList) => {
    let lastError: string | null = null;
    for (const pickedFile of Array.from(files)) {
      const error = validateAttachment(
        { name: pickedFile.name, mimeType: pickedFile.type, size: pickedFile.size },
        uploadAccept,
        uploadMaxSizeBytes,
      );
      if (error) {
        lastError = error;
        continue;
      }
      const dataUrl = await readFileAsDataUrl(pickedFile);
      setAttachments((prev) => [
        ...prev,
        {
          id: generateAttachmentId(),
          name: pickedFile.name,
          mimeType: pickedFile.type,
          size: pickedFile.size,
          dataUrl,
        },
      ]);
    }
    setAttachError(lastError);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (uploadEnabled && !disabled) {
        void handleFilesPicked(e.dataTransfer.files);
      }
    }
  };

  return (
    <form
      data-slot="chat-composer"
      className={cn(
        "flex flex-col rounded-2xl border border-input bg-background shadow-sm transition-[border-color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 relative overflow-hidden",
        isDragging && uploadEnabled && !disabled && "border-ring/50 ring-2 ring-ring/20",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      {...props}
    >
      {isDragging && uploadEnabled && !disabled && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-2xl transition-all duration-300 pointer-events-none">
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-border/50 bg-background shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(255,255,255,0.02)] animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-1 duration-300 ease-out">
            <PaperclipIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium tracking-tight text-foreground">Drop to attach</span>
          </div>
        </div>
      )}

      {todos.length > 0 ? (
        <TodoCard
          todos={todos}
          className="rounded-none rounded-t-2xl border-0 border-b bg-transparent"
        />
      ) : null}

      {attachments.length > 0 ? (
        <div
          data-slot="chat-composer-attachments"
          className="flex flex-wrap gap-1.5 px-3 pt-2"
        >
          {attachments.map((a) => (
            <span
              key={a.id}
              data-slot="chat-composer-attachment"
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              <PaperclipIcon className="size-3" />
              <span className="max-w-40 truncate">{a.name}</span>
              <span className="text-muted-foreground/70">{formatBytes(a.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => removeAttachment(a.id)}
                className="ml-0.5 rounded-full hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {attachError ? (
        <div
          role="alert"
          data-slot="chat-composer-upload-error"
          className="px-3 pt-2 text-xs text-destructive"
        >
          {attachError}
        </div>
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
          <UploadButton
            enabled={uploadEnabled}
            disabled={disabled}
            accept={uploadAccept}
            onPick={handleFilesPicked}
          />
          {usageEnabled && contextUsage ? (
            <ContextMeter usage={contextUsage} className="min-w-0 truncate" />
          ) : null}
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
 * opens a native file picker; picked files are read client-side (base64 data URL, no
 * backend) and validated by the parent (`handleFilesPicked`) — this component only
 * surfaces the picker.
 */
function UploadButton({
  enabled,
  disabled,
  accept,
  onPick,
}: {
  enabled: boolean;
  disabled: boolean;
  accept?: string;
  onPick: (files: FileList) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    // Local provider: ChatComposer must render standalone (customization contract),
    // not depend on an ancestor AppShell's TooltipProvider. Nesting is safe in Radix.
    <TooltipProvider>
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
                accept={accept}
                hidden
                onChange={(e) => {
                  const { files } = e.currentTarget;
                  if (files && files.length > 0) void onPick(files);
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
    </TooltipProvider>
  );
}

export default ChatComposer;
