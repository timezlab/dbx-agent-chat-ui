"use client";

import * as React from "react";
import { GlobeIcon } from "lucide-react";

import { type WebSearchResult, webSearchResultsSchema } from "@/entities";
import { SourceCard, SourceCardList } from "./source-card";

/** Parse a `web_search` output blob into typed sources; `[]` if it isn't a result array. */
export function parseWebSearchResults(detail: string | null): WebSearchResult[] {
  if (!detail) return [];
  let json: unknown;
  try {
    json = JSON.parse(detail);
  } catch {
    return [];
  }
  const parsed = webSearchResultsSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
}

/** Host of a URL for display / favicon lookup; the raw string if it won't parse. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Google's favicon service, keyed by host. Null when the URL is unparseable. */
function faviconSrc(url: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`;
  } catch {
    return null;
  }
}

/** web_search results as source cards: favicon + title + domain, then the preview. */
export function SourceList({ sources }: { sources: WebSearchResult[] }) {
  return (
    <SourceCardList>
      {sources.map((s, i) => (
        <li key={i}>
          <SourceCard
            href={s.url}
            icon={<SourceFavicon url={s.url} />}
            title={s.title || hostnameOf(s.url)}
            trailing={
              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                {hostnameOf(s.url)}
              </span>
            }
            snippet={s.preview}
            clamp={2}
          />
        </li>
      ))}
    </SourceCardList>
  );
}

/** Favicon for a source; falls back to a neutral globe if it can't load. */
function SourceFavicon({ url }: { url: string }) {
  const src = faviconSrc(url);
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center">
        <GlobeIcon className="size-3.5 text-muted-foreground" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon, not a bundled asset
    <img
      src={src}
      alt=""
      role="presentation"
      width={16}
      height={16}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-4 shrink-0 rounded-sm"
    />
  );
}
