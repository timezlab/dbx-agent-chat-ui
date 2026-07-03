import { type SqlResult, sqlResultSchema } from "@/entities";
import { OverlayScroll } from "@/components/overlay-scroll";

/** Parse an `execute_sql` output blob into a table; null if it isn't `{ columns, rows }`. */
export function parseSqlResult(detail: string | null): SqlResult | null {
  if (!detail) return null;
  let json: unknown;
  try {
    json = JSON.parse(detail);
  } catch {
    return null;
  }
  const parsed = sqlResultSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** SQL result as a compact, horizontally-scrollable table. */
export function SqlTable({ table }: { table: SqlResult }) {
  return (
    <div className="space-y-1 py-0.5">
      <OverlayScroll
        axis="x"
        className="rounded-lg border border-border/60"
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              {table.columns.map((c, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium text-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/40 last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground"
                  >
                    {cell === null ? "—" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </OverlayScroll>
      {table.truncated || table.row_count != null ? (
        <div className="text-[10px] text-muted-foreground/70">
          {table.row_count != null ? `${table.row_count} rows` : null}
          {table.truncated ? " · truncated" : null}
        </div>
      ) : null}
    </div>
  );
}
