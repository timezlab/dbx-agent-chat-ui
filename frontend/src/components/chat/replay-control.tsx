"use client";

import * as React from "react";
import {
  FileTextIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Settings2Icon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import type {
  ReplaySession,
  ReplaySource,
  ReplaySpeed,
} from "@/hooks/chat/use-chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Speed presets (D-R3). */
const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];

/** Conservative client-side upload cap (low-MB) — protects the browser (FR-008). */
const DEFAULT_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Label stamped on a recording provided by pasting text (vs. a picked file). */
const PASTED_FILE_LABEL = "Pasted recording";

export interface ReplayControlProps extends Omit<
  React.ComponentProps<"div">,
  "onSelect"
> {
  /** Current replay session state (status / source / timing / error). */
  session: ReplaySession;
  /** Start playback (or resume when paused). */
  onPlay: () => void;
  /** Suspend playback. */
  onPause: () => void;
  /** Clear the replayed conversation (fresh chat screen), staying in Replay mode. */
  onReset: () => void;
  /** Choose the recording source (upload/paste text is read here, client-side). */
  onSetSource: (source: ReplaySource) => void;
  /** Edit the base per-frame delays. */
  onSetTiming: (timing: { textDelayMs?: number; toolDelayMs?: number }) => void;
  /** Reset delays to defaults and speed to ×1. */
  onResetTiming: () => void;
  /** Change the speed multiplier. */
  onSetSpeed: (speed: ReplaySpeed) => void;
  /** Max upload/paste size in bytes; defaults to a conservative low-MB cap. */
  maxUploadBytes?: number;
}

function Stepper({
  value,
  onChange,
  min = 0,
  step = 10,
  ariaLabel,
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  step?: number;
  ariaLabel?: string;
}) {
  const [inputValue, setInputValue] = React.useState<string>(String(value));

  // Resync the local draft when the controlled `value` changes — done during render (the
  // React-recommended derived-state pattern) rather than in an effect, which avoids an extra
  // commit and the react-hooks/set-state-in-effect cascade warning.
  const [prevValue, setPrevValue] = React.useState<number>(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(String(value));
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val === "") {
      setInputValue("");
      return;
    }

    // Xóa các số 0 vô nghĩa ở đầu (ví dụ: 030 -> 30)
    val = val.replace(/^0+(?=\d)/, "");
    setInputValue(val);

    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) {
      onChange(Math.max(min, num));
    }
  };

  const handleBlur = () => {
    if (inputValue === "") {
      setInputValue(String(min));
      onChange(min);
    } else {
      const num = Math.max(min, parseInt(inputValue, 10));
      setInputValue(String(num));
      onChange(num);
    }
  };

  return (
    <div className="flex h-8 items-center rounded-md border border-input bg-background shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-full w-8 rounded-none rounded-l-md border-r border-input hover:bg-muted"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label={`Decrease ${ariaLabel}`}
      >
        <MinusIcon className="h-3 w-3" />
      </Button>
      <input
        type="number"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        className="h-full w-12 border-0 bg-transparent text-center text-xs focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-full w-8 rounded-none rounded-r-md border-l border-input hover:bg-muted"
        onClick={() => onChange(value + step)}
        aria-label={`Increase ${ariaLabel}`}
      >
        <PlusIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

/**
 * The Replay transport controls, rendered as a **sticky icon rail on the right edge** of the
 * chat surface while Replay mode is on (FR-030). The rail carries only play/pause + restart so
 * it barely covers the transcript (FR-033); a settings button opens a **dialog** holding the
 * full config (source, upload/paste, per-frame timing, speed). The composer stays in place (it
 * hosts the typing effect). Client-only playback — no network — via the `useChat` replay
 * surface passed as props.
 */
export function ReplayControl({
  session,
  onPlay,
  onPause,
  onReset,
  onSetSource,
  onSetTiming,
  onResetTiming,
  onSetSpeed,
  maxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
  className,
  ...props
}: ReplayControlProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  // The settings dialog is closed by default so the rail barely covers the transcript (FR-033).
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  // Local draft of the pasted / uploaded recording text, so the textarea is editable and a
  // picked file's contents are shown for tweaking. Kept only in the component; the source of
  // truth is pushed to the replay hook via `onSetSource`.
  const [pasteText, setPasteText] = React.useState("");
  // Highlight the drop zone while a file is dragged over it.
  const [dragActive, setDragActive] = React.useState(false);

  const isPlaying = session.status === "playing";
  const isPaused = session.status === "paused";
  const sourceLocked = isPlaying || isPaused;
  // Play is allowed with the default source, or an upload/paste that read cleanly.
  const canPlay =
    session.source === "default" ||
    (session.fileName != null && session.error == null);
  const error = uploadError ?? session.error;

  const handleSourceChange = (value: string) => {
    setUploadError(null);
    if (value === "default") {
      setPasteText("");
      onSetSource({ kind: "default" });
    } else if (!session.fileName) {
      // Switch to upload/paste but keep Play disabled until content is provided.
      onSetSource({ kind: "upload", fileName: "", text: "" });
    }
  };

  // Push provided recording text (from a file or the textarea) into the replay source.
  const applyText = (text: string, fileName: string) => {
    if (text.length > maxUploadBytes) {
      setUploadError(
        `Recording is too large (max ${Math.round(maxUploadBytes / (1024 * 1024))} MB).`,
      );
      return;
    }
    setUploadError(null);
    onSetSource({ kind: "upload", fileName, text });
  };

  const handleFilePicked = (file: File) => {
    setUploadError(null);
    const isTxt =
      file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
    if (!isTxt) {
      setUploadError("Please choose a plain-text .txt recording.");
      return;
    }
    if (file.size > maxUploadBytes) {
      setUploadError(
        `File is too large (max ${Math.round(maxUploadBytes / (1024 * 1024))} MB).`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setPasteText(text); // show the picked file's contents so they can be tweaked
      applyText(text, file.name);
    };
    reader.onerror = () => setUploadError("Could not read the selected file.");
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    applyText(text, PASTED_FILE_LABEL);
  };

  // Empty the custom recording back to a blank slate (keeps the Custom source selected).
  const clearCustom = () => {
    setUploadError(null);
    setPasteText("");
    onSetSource({ kind: "upload", fileName: "", text: "" });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (sourceLocked) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFilePicked(file);
  };

  // Play from inside the dialog and dismiss it, so the transcript (behind the modal) is visible
  // as it replays — no need to close the dialog first (FR-030).
  const handleStart = () => {
    if (!canPlay) return;
    onPlay();
    setSettingsOpen(false);
  };

  const handleDelayChange =
    (key: "textDelayMs" | "toolDelayMs") => (value: number) => {
      onSetTiming({ [key]: Number.isFinite(value) ? value : 0 });
    };

  const playPauseButton = isPlaying ? (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={onPause}
      data-slot="replay-pause"
      aria-label="Pause replay"
      className="h-10 w-10 shrink-0 rounded-full"
    >
      <PauseIcon fill="currentColor" />
    </Button>
  ) : (
    <Button
      type="button"
      size="icon"
      onClick={onPlay}
      disabled={!canPlay}
      data-slot="replay-play"
      aria-label="Play replay"
      className="h-10 w-10 shrink-0 rounded-full"
    >
      <PlayIcon fill="currentColor" className="ml-0.5" />
    </Button>
  );

  const restartButton = (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onReset}
      data-slot="replay-restart"
      aria-label="Restart replay (clear chat)"
      title="Restart replay (clear chat)"
      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
    >
      <RefreshCwIcon className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {/* Slim vertical icon rail — play/pause, restart, and a settings toggle that opens the
          config dialog. Barely covers the transcript (FR-033). */}
      <div
        data-slot="replay-control"
        className={cn(
          "flex w-14 flex-col items-center gap-2 rounded-2xl border border-input bg-background/95 p-2 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80",
          className,
        )}
        {...props}
      >
        {playPauseButton}
        {restartButton}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          data-slot="replay-settings"
          aria-label="Show replay settings"
          title="Show replay settings"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Settings2Icon className="h-4 w-4" />
        </Button>
        {error ? (
          <span
            role="alert"
            data-slot="replay-error"
            aria-label={error}
            title={error}
            className="h-2 w-2 shrink-0 rounded-full bg-destructive"
          />
        ) : null}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          data-slot="replay-settings-dialog"
          // Header + footer stay fixed; only the middle body scrolls, so Start/Clear are always
          // reachable without scrolling to the bottom.
          className="pointer-events-auto flex max-h-[85vh] max-w-md flex-col gap-4 overflow-hidden rounded-md"
        >
          <DialogHeader className="flex-none">
            <DialogTitle>Replay settings</DialogTitle>
            <DialogDescription>
              {isPlaying ? "Playing…" : isPaused ? "Paused" : "Ready"} · choose
              a recording and tune playback pacing.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          {/* Source — a two-way segmented control (D-R2): the bundled sample, or a recording
              the user pastes / drops in. Cleaner than a dropdown for a binary choice. */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Recording source
            </Label>
            <div
              role="tablist"
              aria-label="Recording source"
              data-slot="replay-source"
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            >
              {(
                [
                  {
                    value: "default",
                    icon: SparklesIcon,
                    label: "Default",
                    hint: "Bundled sample",
                  },
                  {
                    value: "upload",
                    icon: FileTextIcon,
                    label: "Custom",
                    hint: "Paste or .txt",
                  },
                ] as const
              ).map((opt) => {
                const active = session.source === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={sourceLocked}
                    onClick={() => handleSourceChange(opt.value)}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom recording — a single paste/drop/browse surface (replaces the bare upload
              button). The dashed frame is the drop target; the borderless textarea inside takes
              a paste; a hairline footer shows the loaded file + a clear affordance. */}
          {session.source === "upload" ? (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="replay-paste"
                className="text-xs font-medium text-muted-foreground"
              >
                Paste recording, or drop a .txt file
              </Label>
              <div
                data-slot="replay-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!sourceLocked) setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col overflow-hidden rounded-lg border border-dashed transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-input bg-background",
                )}
              >
                <Textarea
                  id="replay-paste"
                  data-slot="replay-paste"
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  disabled={sourceLocked}
                  placeholder={
                    dragActive
                      ? "Drop the .txt recording to load it"
                      : "Paste the recorded SSE (data: … frames) here, or drop a .txt file"
                  }
                  // Fixed height with internal scroll: override `field-sizing-content` (which would
                  // grow the box to fit a large paste and overflow the dialog) and drag-resize.
                  className="h-44 resize-none overflow-y-auto rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 field-sizing-fixed"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                    {session.fileName
                      ? session.fileName
                      : pasteText
                        ? "Unsaved paste"
                        : "No recording loaded"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {pasteText ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={sourceLocked}
                        onClick={clearCustom}
                        data-slot="replay-clear"
                        aria-label="Clear recording"
                        className="h-7 gap-1 px-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="h-7 gap-1 px-1.5"
                      disabled={sourceLocked}
                      onClick={() => fileInputRef.current?.click()}
                      data-slot="replay-upload"
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      Browse
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleFilePicked(file);
              e.currentTarget.value = "";
            }}
          />

          {/* Timing + speed */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="replay-text-delay"
                className="whitespace-nowrap text-xs font-medium text-muted-foreground"
              >
                Text Delay
              </Label>
              <Stepper
                value={session.textDelayMs}
                onChange={handleDelayChange("textDelayMs")}
                step={10}
                ariaLabel="Text delay"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="replay-tool-delay"
                className="whitespace-nowrap text-xs font-medium text-muted-foreground"
              >
                Tool Delay
              </Label>
              <Stepper
                value={session.toolDelayMs}
                onChange={handleDelayChange("toolDelayMs")}
                step={100}
                ariaLabel="Tool delay"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="replay-speed"
                className="whitespace-nowrap text-xs font-medium text-muted-foreground"
              >
                Speed
              </Label>
              <Select
                value={String(session.speed)}
                onValueChange={(val) => onSetSpeed(Number(val) as ReplaySpeed)}
              >
                <SelectTrigger
                  id="replay-speed"
                  className="h-8 w-20 bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEEDS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      ×{s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onResetTiming}
              data-slot="replay-reset"
              aria-label="Reset timing"
              className="h-8 justify-start px-2 text-muted-foreground hover:text-foreground"
            >
              <RotateCcwIcon className="mr-1.5 h-3.5 w-3.5" />
              Reset timing
            </Button>
          </div>

          {error ? (
            <div
              role="alert"
              data-slot="replay-dialog-error"
              className="text-xs font-medium text-destructive"
            >
              {error}
            </div>
          ) : null}
          </div>

          {/* Primary action inline: start (or pause) without dismissing the dialog first. */}
          <DialogFooter className="flex-none sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              data-slot="replay-dialog-reset"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCwIcon className="h-4 w-4" />
              Clear chat
            </Button>
            {isPlaying ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onPause}
                data-slot="replay-dialog-pause"
              >
                <PauseIcon className="h-4 w-4" fill="currentColor" />
                Pause
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleStart}
                disabled={!canPlay}
                data-slot="replay-start"
              >
                <PlayIcon className="h-4 w-4" fill="currentColor" />
                {isPaused ? "Resume" : "Start replay"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReplayControl;
