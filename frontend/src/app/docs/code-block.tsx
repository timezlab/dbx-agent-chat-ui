"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, FileCode2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Highlight, themes } from "prism-react-renderer";
import { useTheme } from "next-themes";

export function CodeBlock({ 
  title, 
  language,
  children,
  codeString,
  className
}: { 
  title?: string; 
  language?: string;
  children: React.ReactNode;
  codeString?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === "dark";

  // Safely extract string if possible, otherwise fallback
  const rawCode = codeString || (typeof children === 'string' ? children : "");

  const handleCopy = () => {
    if (!rawCode) return;
    
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "group relative my-6 rounded-[1.25rem] border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden transition-colors",
      className
    )}>
      {/* Top Bar - "Double-Bezel" Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-200/50 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 transition-colors">
        <div className="flex items-center gap-4">
          {/* Traffic Lights (Mac style) */}
          <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50" />
          </div>
          
          {title && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
              <FileCode2Icon className="size-3.5 opacity-70" />
              <span>{title}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {language && (
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5">
              {language}
            </span>
          )}
          
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center justify-center p-1.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer active:scale-95"
            aria-label="Copy code"
            title="Copy to clipboard"
          >
            {copied ? <CheckIcon className="size-3.5 text-emerald-500 dark:text-emerald-400" /> : <CopyIcon className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="p-5 overflow-x-auto text-[13px] leading-[1.7] font-mono selection:bg-blue-500/20 dark:selection:bg-white/20 selection:text-slate-900 dark:selection:text-white">
        {rawCode ? (
          <Highlight 
            theme={isDark ? themes.vsDark : themes.github} 
            code={rawCode.trim()} 
            language={
              ['bash', 'python', 'json', 'typescript', 'javascript', 'jsx', 'tsx', 'css', 'html'].includes(language as string) 
                ? (language as import('prism-react-renderer').Language) 
                : 'text'
            }
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre className={className} style={{ ...style, backgroundColor: 'transparent' }}>
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
          <pre className="text-slate-700 dark:text-zinc-300">
            <code>{children}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
