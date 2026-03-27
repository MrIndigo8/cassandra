'use client';

interface DataTableProps<T> {
  columns: { key: string; header: string; render?: (row: T) => React.ReactNode }[];
  data: T[];
  loading?: boolean;
  pagination?: { page: number; total: number; onPageChange: (page: number) => void };
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  pagination,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left font-semibold text-text-secondary">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-center text-text-muted" colSpan={columns.length}>
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-text-muted" colSpan={columns.length}>
                No data
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={idx}
                className={`border-t border-border ${onRowClick ? 'cursor-pointer hover:bg-surface' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-text-primary">
                    {column.render ? column.render(row) : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pagination ? (
        <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-3 text-xs">
          <span className="text-text-muted">Page {pagination.page}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
              disabled={pagination.page >= pagination.total}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
