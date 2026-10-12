"use client";

import {
  ClientSideRowModelModule,
  ModuleRegistry,
  TextFilterModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryRow } from "@/lib/home/history";

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule, // filter by brand (HM-FR-17)
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

// DESIGN.md tokens, as the checklist grid reads them.
const theme = themeQuartz.withParams({
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  headerFontSize: 12.5,
  headerFontWeight: 700,
  foregroundColor: "var(--color-ink)",
  textColor: "var(--color-ink)",
  headerTextColor: "var(--color-ink-2)",
  headerBackgroundColor: "var(--color-latte-wash)",
  accentColor: "var(--color-espresso)",
  borderColor: "var(--color-line)",
  rowBorder: { color: "var(--color-line-soft)" },
  wrapperBorderRadius: 20,
  rowHoverColor: "var(--color-latte-wash)",
  cellHorizontalPadding: 14,
  headerHeight: 44,
  rowHeight: 48,
  backgroundColor: "var(--color-surface)",
  columnBorder: false,
  headerColumnBorder: false,
});

/** Grid width below which the fee and hold reference collapse first (HM-FR-17). */
const WIDE_MIN_PX = 1100;

const BrandCell = ({ data }: ICellRendererParams<HistoryRow>) =>
  data ? (
    <Link href={data.href} className="font-bold underline-offset-3 hover:underline">
      {data.brand}
    </Link>
  ) : null;

/**
 * The payment history as an AG Grid table, from `md:` up; phones get cards
 * from the same rows. Sorts by date, brand or amount, filters by brand;
 * references are selectable to copy. Under 1100px of grid width the fee and
 * hold reference drop out, so nothing scrolls sideways.
 *
 * @param rows - the history rows, newest first
 * @see docs/specs/creator-home-frd.md HM-FR-16 to HM-FR-18; docs/decisions/2026-10-12-ag-grid-and-ag-charts-on-creator-home.md
 */
export default function HistoryGrid({ rows }: { rows: HistoryRow[] }) {
  const [wide, setWide] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= WIDE_MIN_PX));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columnDefs = useMemo<ColDef<HistoryRow>[]>(() => {
    const cols: (ColDef<HistoryRow> & { wideOnly?: boolean })[] = [
      { colId: "date", headerName: "Date paid", field: "date", width: 130, sort: "desc", comparator: (_a, _b, a, b) => (a.data?.paidAtMs ?? 0) - (b.data?.paidAtMs ?? 0) },
      { colId: "brand", headerName: "Brand", field: "brand", flex: 1, minWidth: 140, filter: "agTextColumnFilter", cellRenderer: BrandCell },
      { colId: "post", headerName: "Post", field: "post", width: 130, sortable: false },
      { colId: "amount", headerName: "Deal amount", field: "amount", width: 128, type: "rightAligned", comparator: (_a, _b, a, b) => (a.data?.amountMinor ?? 0) - (b.data?.amountMinor ?? 0) },
      { colId: "fee", headerName: "Fee", field: "fee", width: 96, type: "rightAligned", sortable: false, wideOnly: true },
      { colId: "received", headerName: "Received", field: "received", width: 124, type: "rightAligned", cellClass: "font-extrabold", comparator: (_a, _b, a, b) => (a.data?.receivedMinor ?? 0) - (b.data?.receivedMinor ?? 0) },
      { colId: "payout", headerName: "Payout reference", field: "payoutReference", width: 150, sortable: false, cellClass: "text-ink-2 tabular-nums" },
      { colId: "hold", headerName: "Hold reference", field: "holdReference", width: 140, sortable: false, cellClass: "text-ink-2 tabular-nums", wideOnly: true },
    ];
    return cols.filter((c) => wide || !c.wideOnly).map(({ wideOnly, ...c }) => (void wideOnly, c));
  }, [wide]);

  return (
    <div ref={boxRef}>
      <AgGridReact<HistoryRow>
        theme={theme}
        rowData={rows}
        columnDefs={columnDefs}
        getRowId={(p) => p.data.id}
        domLayout="autoHeight"
        suppressColumnVirtualisation
        enableCellTextSelection
        defaultColDef={{ sortable: true, resizable: false, suppressMovable: true }}
        tabToNextCell={() => false}
        tabToNextHeader={() => false}
        onGridSizeChanged={(e) => setWide(e.clientWidth >= WIDE_MIN_PX)}
      />
    </div>
  );
}
