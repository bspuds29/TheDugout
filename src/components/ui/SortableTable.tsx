import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './SortableTable.css';

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  defaultSort?: string;
  defaultDir?: 'asc' | 'desc';
  compact?: boolean;
}

export default function SortableTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  onRowClick,
  defaultSort,
  defaultDir = 'desc',
  compact = false,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSort);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="stable-wrap">
      <table className={`stable ${compact ? 'stable--compact' : ''}`}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                className={`stable-th ${col.sortable ? 'stable-th--sortable' : ''} stable-align--${col.align ?? 'right'}`}
                style={{ width: col.width }}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
              >
                {col.label}
                {col.sortable && (
                  <span className="stable-sort-icon">
                    {sortKey === String(col.key)
                      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      : <ChevronDown size={12} className="stable-sort-dim" />}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={String(row[rowKey])}
              className={`stable-row ${onRowClick ? 'stable-row--clickable' : ''} ${i === 0 ? 'stable-row--top' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  className={`stable-td stable-align--${col.align ?? 'right'}`}
                >
                  {col.render
                    ? col.render(row[String(col.key)], row)
                    : String(row[String(col.key)] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
