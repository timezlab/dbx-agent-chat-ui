"use client";

import * as React from "react";
import { PlayIcon, SparklesIcon } from "lucide-react";
import { resolveConfig } from "@/lib/config";
import { ChatProvider, useChatContext } from "@/components/chat/chat-provider";
import { ChatScreen } from "@/components/chat/chat-screen";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Live embed of the real chat UI, driven by replay mode (no backend needed). */
export function DocsDemo() {
  const config = React.useMemo(() => resolveConfig(), []);
  // Do not auto-open: the visitor starts the demo when they want it.
  const [started, setStarted] = React.useState(false);

  return (
    <div className="relative mx-auto flex h-[650px] w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
      <div className="relative z-20 flex items-center border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#FF5F56]" />
          <span className="size-3 rounded-full bg-[#FFBD2E]" />
          <span className="size-3 rounded-full bg-[#27C93F]" />
        </div>
        <span className="absolute inset-x-0 text-center text-xs font-medium text-muted-foreground">
          Interactive demo
        </span>
        {started && (
          <span className="ml-auto rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
            replay mode
          </span>
        )}
      </div>

      <div className="relative z-10 flex-1 overflow-hidden bg-background/50">
        {started ? (
          <ChatProvider config={config}>
            <DemoAutomator />
            <TooltipProvider>
              <ChatScreen className="absolute inset-0" />
            </TooltipProvider>
          </ChatProvider>
        ) : (
          <DemoPoster onStart={() => setStarted(true)} />
        )}
      </div>
    </div>
  );
}

/** Idle state shown before the visitor launches the replay. */
function DemoPoster({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/5 to-transparent"
      />
      <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
        <SparklesIcon className="size-5" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-medium tracking-tight">
          See the chat UI in action
        </h3>
        <p className="max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
          Play a recorded agent session, streaming, tool timelines, and
          markdown, rendered entirely client-side. No backend required.
        </p>
      </div>
      <button
        onClick={onStart}
        className="group cursor-pointer inline-flex items-center gap-2 rounded-full bg-foreground py-2.5 pl-5 pr-6 font-medium text-background transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
      >
        <PlayIcon className="size-4 fill-current" />
        <span>Play demo</span>
      </button>
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
    messages,
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
    if (
      messages.length === 0 &&
      replaySession.status === "idle" &&
      !isGenerating
    ) {
      const t = setTimeout(() => {
        replayPlay();
      }, 600);
      return () => clearTimeout(t);
    }

    // 3. When finished, wait 15 seconds, then reset by turning off (which triggers step 1)
    if (
      messages.length > 0 &&
      !isGenerating &&
      replaySession.status === "idle"
    ) {
      const t = setTimeout(() => {
        toggleReplayMode();
      }, 15000); // 15s sleep
      return () => clearTimeout(t);
    }
  }, [
    replayMode,
    isGenerating,
    messages.length,
    replaySession.status,
    toggleReplayMode,
    replayPlay,
  ]);

  return null;
}
