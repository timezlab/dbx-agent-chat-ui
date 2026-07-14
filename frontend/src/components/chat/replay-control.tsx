"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  FileTextIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Settings2Icon,
  UploadIcon,
} from "lucide-react";

import type {
  ReplaySession,
  ReplaySource,
  ReplaySpeed,
} from "@/hooks/chat/use-chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Speed presets (D-R3). */
const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];

/** Conservative client-side upload cap (low-MB) — protects the browser (FR-008). */
const DEFAULT_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface ReplayControlProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** Current replay session state (status / source / timing / error). */
  session: ReplaySession;
  /** Start playback (or resume when paused). */
  onPlay: () => void;
  /** Suspend playback. */
  onPause: () => void;
  /** Clear the replayed conversation (fresh chat screen), staying in Replay mode. */
  onReset: () => void;
  /** Choose the recording source (upload text is read here, client-side). */
  onSetSource: (source: ReplaySource) => void;
  /** Edit the base per-frame delays. */
  onSetTiming: (timing: { textDelayMs?: number; toolDelayMs?: number }) => void;
  /** Reset delays to defaults and speed to ×1. */
  onResetTiming: () => void;
  /** Change the speed multiplier. */
  onSetSpeed: (speed: ReplaySpeed) => void;
  /** Max upload size in bytes; defaults to a conservative low-MB cap. */
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
 * The Replay transport controls, rendered as a **sticky panel on the right edge** of the chat
 * surface while Replay mode is on (FR-030). It stays **collapsed to an icon rail** by default so
 * it barely covers the transcript, and expands to the full settings panel only when the user
 * opens it (FR-033). The composer stays in place (it hosts the typing effect); this panel only
 * carries play/pause, restart, source, speed, and per-frame timing. Client-only playback — no
 * network — via the `useChat` replay surface passed as props.
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
  // Collapsed (icon rail) by default so it doesn't cover the transcript; expand to edit.
  const [expanded, setExpanded] = React.useState(false);

  const isPlaying = session.status === "playing";
  const isPaused = session.status === "paused";
  // Play is allowed with the default source, or an uploaded file that read cleanly.
  const canPlay =
    session.source === "default" ||
    (session.fileName != null && session.error == null);
  const error = uploadError ?? session.error;

  const handleSourceChange = (value: string) => {
    setUploadError(null);
    if (value === "default") {
      onSetSource({ kind: "default" });
    } else if (fileInputRef.current == null || !session.fileName) {
      // Switch to upload but keep Play disabled until a file is chosen.
      onSetSource({ kind: "upload", fileName: "", text: "" });
    }
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
      onSetSource({ kind: "upload", fileName: file.name, text });
    };
    reader.onerror = () => setUploadError("Could not read the selected file.");
    reader.readAsText(file);
  };

  const handleDelayChange =
    (key: "textDelayMs" | "toolDelayMs") => (value: number) => {
      onSetTiming({ [key]: Number.isFinite(value) ? value : 0 });
    };

  // Shared across the collapsed rail and the expanded header so play state is identical.
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

  // Collapsed: a slim vertical icon rail — play/pause, restart, and a settings toggle to
  // expand. Barely covers the transcript (FR-033).
  if (!expanded) {
    return (
      <div
        data-slot="replay-control"
        data-expanded="false"
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
          onClick={() => setExpanded(true)}
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
    );
  }

  // Expanded: the full settings panel.
  return (
    <div
      data-slot="replay-control"
      data-expanded="true"
      className={cn(
        "flex w-64 flex-col gap-3 rounded-2xl border border-input bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80",
        className,
      )}
      {...props}
    >
      {/* Header: play/pause + status + collapse */}
      <div className="flex items-center gap-3">
        {playPauseButton}

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">Replay Mode</span>
          <span className="text-xs font-medium text-muted-foreground">
            {isPlaying ? "Playing…" : isPaused ? "Paused" : "Ready"}
          </span>
        </div>

        {restartButton}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setExpanded(false)}
          data-slot="replay-collapse"
          aria-label="Hide replay settings"
          title="Hide replay settings"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Source + upload */}
      <div className="flex items-center gap-2">
        <Select
          value={session.source}
          onValueChange={handleSourceChange}
          disabled={isPlaying || isPaused}
        >
          <SelectTrigger id="replay-source" className="h-9 min-w-0 flex-1">
            <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Select source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default recording</SelectItem>
            <SelectItem value="upload">
              {session.fileName ? session.fileName : "Upload .txt…"}
            </SelectItem>
          </SelectContent>
        </Select>

        {session.source === "upload" ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            disabled={isPlaying || isPaused}
            onClick={() => fileInputRef.current?.click()}
            title="Choose file"
            data-slot="replay-upload"
          >
            <UploadIcon className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

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
            <SelectTrigger id="replay-speed" className="h-8 w-20 bg-background">
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
          data-slot="replay-error"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default ReplayControl;
