import type { Conversation } from "@/entities";

// Seed data for the dev-only history mock. Shared by the list route (summaries) and the
// `[conversationId]` detail route so the two never drift. Not a route itself (no
// `route`/`page` name) and only imported by `.dev.ts` routes, so it never reaches the
// static export. Fixed epoch-ms timestamps keep the mock deterministic (no clock).
const HOUR = 3_600_000;
const T0 = 1_735_732_800_000; // 2025-01-01T12:00:00Z

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-delta-sql",
    activeId: null,
    queue: [],
    status: "idle",
    messages: [
      {
        id: "c1-m1",
        role: "user",
        parts: [{ type: "text", text: "How do I read a Delta table with SQL?" }],
        attachments: [],
        status: "complete",
        error: null,
        feedback: null,
        createdAt: T0,
      },
      {
        id: "c1-m2",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Query it directly by name:\n\n```sql\nSELECT * FROM samples.nyctaxi.trips LIMIT 10;\n```\n\nDelta tables registered in Unity Catalog are addressable as `catalog.schema.table`.",
          },
        ],
        attachments: [],
        status: "complete",
        error: null,
        // Rating + comment — restored from history, the panel shows the saved note.
        feedback: {
          rating: "up",
          comment: "Exactly what I needed.",
          submittedAt: T0 + 20_000,
        },
        createdAt: T0 + 5_000,
      },
      {
        id: "c1-m3",
        role: "user",
        parts: [{ type: "text", text: "And the PySpark version?" }],
        attachments: [],
        status: "complete",
        error: null,
        feedback: null,
        createdAt: T0 + 60_000,
      },
      {
        id: "c1-m4",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: '```python\ndf = spark.read.table("samples.nyctaxi.trips")\ndf.show(10)\n```',
          },
        ],
        attachments: [],
        status: "complete",
        error: null,
        // Thumbs-down with no comment — a rating-only feedback record.
        feedback: { rating: "down", submittedAt: T0 + 80_000 },
        createdAt: T0 + 65_000,
      },
    ],
  },
  {
    id: "conv-vector-search",
    activeId: null,
    queue: [],
    status: "idle",
    messages: [
      {
        id: "c2-m1",
        role: "user",
        parts: [{ type: "text", text: "What is Mosaic AI Vector Search?" }],
        attachments: [],
        status: "complete",
        error: null,
        feedback: null,
        createdAt: T0 + HOUR,
      },
      {
        id: "c2-m2",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "It's a vector database on Databricks that indexes embeddings so you can run similarity search over your Delta tables — the backbone of RAG retrieval.",
          },
        ],
        attachments: [],
        status: "complete",
        error: null,
        feedback: null, // no rating yet
        createdAt: T0 + HOUR + 4_000,
      },
    ],
  },
  {
    id: "conv-unity-catalog",
    activeId: null,
    queue: [],
    status: "idle",
    messages: [
      {
        id: "c3-m1",
        role: "user",
        parts: [{ type: "text", text: "Grant a user read access to a schema" }],
        attachments: [],
        status: "complete",
        error: null,
        feedback: null,
        createdAt: T0 + 2 * HOUR,
      },
      {
        id: "c3-m2",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "```sql\nGRANT USE SCHEMA, SELECT ON SCHEMA main.analytics TO `data.analyst@acme.com`;\n```",
          },
        ],
        attachments: [],
        status: "complete",
        error: null,
        feedback: {
          rating: "up",
          comment: "Worked first try.",
          submittedAt: T0 + 2 * HOUR + 30_000,
        },
        createdAt: T0 + 2 * HOUR + 5_000,
      },
    ],
  },
];

/** Look up one seeded conversation by id (null when unknown). */
export function findMockConversation(id: string): Conversation | null {
  return MOCK_CONVERSATIONS.find((c) => c.id === id) ?? null;
}
