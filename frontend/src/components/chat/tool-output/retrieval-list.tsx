import { FileTextIcon } from "lucide-react";

import { type RetrievalChunk, retrievalResultsSchema } from "@/entities";
import { SourceCard, SourceCardList } from "./source-card";

/** Parse a `vector_search` output blob into chunks; `[]` if it isn't a chunk array. */
export function parseRetrievalResults(detail: string | null): RetrievalChunk[] {
  if (!detail) return [];
  let json: unknown;
  try {
    json = JSON.parse(detail);
  } catch {
    return [];
  }
  const parsed = retrievalResultsSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
}

/** Retrieval chunks as source cards: source + similarity score, then the matched content. */
export function RetrievalList({ chunks }: { chunks: RetrievalChunk[] }) {
  return (
    <SourceCardList>
      {chunks.map((c, i) => (
        <li key={i}>
          <SourceCard
            icon={
              <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            }
            title={c.source || `Result ${i + 1}`}
            trailing={
              c.score != null ? (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {c.score.toFixed(2)}
                </span>
              ) : undefined
            }
            snippet={c.content}
            clamp={3}
          />
        </li>
      ))}
    </SourceCardList>
  );
}
