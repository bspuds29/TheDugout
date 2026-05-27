import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './SortableTable.css';

export interface SortMeta {
  sortDir: 'asc' | 'desc';
  total: number;
  /** true when the table is currently sorted worst-first (opposite of the column's natural best direction) */
  reversed: boolean;
  /** The key currently being sorted on — used for tie-rank computation */
  sortKey: string | undefined;
  /** The fully sorted data array — used for tie-rank computation */
  sortedData: unknown[];
}

interface Column<T> {
  key: keyof T | string;
  label: string;
  /** Short tooltip shown on hover over the column header info icon */
  tooltip?: string;
  sortable?: boolean;
  /** Direction to use the first time this column is clicked. Defaults to 'desc'.
   *  Set to 'asc' for stats where lower is better (ERA, WHIP, K% for batters, etc.) */
  firstClickDir?: 'asc' | 'desc';
  render?: (value: unknown, row: T, rowIndex: number, meta: SortMeta) => React.ReactNode;
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

// ─── Portal tooltip — renders at document.body, never clipped ────────

interface TipState { text: string; x: number; y: number }

function TipPortal({ tip }: { tip: TipState }) {
  const TIP_W = 230;
  const pad   = 10;
  // clamp horizontally so it never runs off screen
  const left = Math.max(pad, Math.min(tip.x - TIP_W / 2, window.innerWidth - TIP_W - pad));

  return createPortal(
    <div
      className="stable-tip-portal"
      style={{ left, top: tip.y }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}

// ─── Column header cell with optional tooltip icon ────────────────────

function ThCell({ col, isActive, sortDir, onSort }: {
  col: Column<any>;
  isActive: boolean;
  sortDir: 'asc' | 'desc';
  onSort: () => void;
}) {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTip = useCallback((e: React.MouseEvent) => {
    if (!col.tooltip) return;
    if (timer.current) clearTimeout(timer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ text: col.tooltip, x: rect.left + rect.width / 2, y: rect.top - 8 + window.scrollY });
  }, [col.tooltip]);

  const hideTip = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTip(null), 60);
  }, []);

  return (
    <th
      className={`stable-th ${col.sortable ? 'stable-th--sortable' : ''} ${isActive ? 'stable-th--active' : ''} stable-align--${col.align ?? 'right'}`}
      style={{ width: col.width }}
      onClick={col.sortable ? onSort : undefined}
    >
      {col.label}
      {col.tooltip && (
        <span
          className="stable-tip-icon"
          onMouseEnter={showTip}
          onMouseLeave={hideTip}
        >
          ⓘ
        </span>
      )}
      {col.sortable && (
        <span className="stable-sort-icon">
          {isActive
            ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
            : <ChevronDown size={12} className="stable-sort-dim" />}
        </span>
      )}
      {tip && <TipPortal tip={tip} />}
    </th>
  );
}

// ─── SortableTable ────────────────────────────────────────────────────

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
      const col = columns.find(c => String(c.key) === key);
      setSortKey(key);
      setSortDir(col?.firstClickDir ?? 'desc');
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

  const activeCol = sortKey ? columns.find(c => String(c.key) === sortKey) : undefined;
  const naturalDir = activeCol?.firstClickDir ?? 'desc';
  const reversed = !!sortKey && sortDir !== naturalDir;
  const meta: SortMeta = { sortDir, total: sorted.length, reversed, sortKey, sortedData: sorted as unknown[] };

  return (
    <div className="stable-wrap">
      <table className={`stable ${compact ? 'stable--compact' : ''}`}>
        <thead>
          <tr>
            {columns.map(col => (
              <ThCell
                key={String(col.key)}
                col={col}
                isActive={!!col.sortable && sortKey === String(col.key)}
                sortDir={sortDir}
                onSort={() => handleSort(String(col.key))}
              />
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
              {columns.map(col => {
                const isActive = col.sortable && sortKey === String(col.key);
                return (
                  <td
                    key={String(col.key)}
                    className={`stable-td ${isActive ? 'stable-td--active' : ''} stable-align--${col.align ?? 'right'}`}
                  >
                    {col.render
                      ? col.render(row[String(col.key)], row, i, meta)
                      : String(row[String(col.key)] ?? '—')}
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
