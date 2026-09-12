import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  numeric?: boolean;
  align?: "left" | "center" | "right";
  render: (row: T) => ReactNode;
  hint?: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  caption: string;
  empty?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-lg border border-borda bg-bg-elev",
        className,
      )}
    >
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-borda-forte">
            {columns.map((column) => {
              const numeric = column.numeric || column.align === "right";
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-xs font-normal text-texto-3",
                    numeric
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-borda transition-colors last:border-0 hover:bg-bg-elev-2"
            >
              {columns.map((column) => {
                const numeric = column.numeric || column.align === "right";
                const hint = column.hint?.(row);
                return (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3.5 text-sm text-texto",
                      numeric && "text-right font-data tabular-nums",
                      column.align === "center" && "text-center",
                      column.className,
                    )}
                  >
                    <span
                      className={cn(
                        "flex flex-col gap-0.5",
                        numeric && "items-end",
                      )}
                    >
                      <span>{column.render(row)}</span>
                      {hint ? (
                        <span className="text-xs text-texto-3">{hint}</span>
                      ) : null}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
