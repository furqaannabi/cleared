"use client";

import {
  ClientSideRowModelModule,
  ModuleRegistry,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NEED_ORDER, type ItemStatus } from "@/lib/checklist/item-status";
import { itemTime, kindLabel } from "@/lib/checklist/item-labels";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { useChecklistWords, type ChecklistWords } from "./checklist-words";
import { StatusChip } from "./status-chip";
import { StatusSeal } from "./status-seal";

// Only the modules this grid uses, to keep the bundle down.
// Sorting is built into the core in v36 (its module is internal).
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowApiModule, // forEachNode, to mark the selected row
  RowSelectionModule,
  RowStyleModule,
  // Names any missing module in development and tests; never shipped.
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

// DESIGN.md tokens, read as CSS variables so the grid and the cards share one source.
const theme = themeQuartz.withParams({
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  headerFontSize: 12.5,
  headerFontWeight: 700,
  foregroundColor: "var(--color-ink)",
  textColor: "var(--color-ink)",
  headerTextColor: "var(--color-ink-3)",
  headerBackgroundColor: "var(--color-latte-wash)",
  accentColor: "var(--color-espresso)",
  borderColor: "var(--color-line)",
  rowBorder: { color: "var(--color-line-soft)" },
  wrapperBorderRadius: 20,
  rowHoverColor: "var(--color-latte-wash)",
  selectedRowBackgroundColor: "var(--color-latte)",
  cellHorizontalPadding: 16,
  headerHeight: 44,
  rowHeight: 64,
  backgroundColor: "var(--color-surface)",
  columnBorder: false,
  headerColumnBorder: false,
});


/** Grid width below which Kind and Brief drop out (DC-FR-40). */
const WIDE_MIN_PX = 1000;

const SealCell = ({ data }: ICellRendererParams<ItemView>) =>
  data ? <StatusSeal status={data.status} className="size-7" /> : null;

// The seal column shows no header text, but is still named for screen readers.
const SealHeader = () => <span className="sr-only">Status</span>;

const ItemCell = ({ data }: ICellRendererParams<ItemView>) =>
  data ? (
    <div className="flex h-full flex-col justify-center leading-snug">
      <b className="truncate font-bold">{data.name}</b>
      {data.evidence && <span className="truncate text-chip text-ink-3">{data.evidence.text}</span>}
    </div>
  ) : null;

const TimeCell = ({ data }: ICellRendererParams<ItemView>) => {
  if (!data) return null;
  const time = itemTime(data);
  if (time) return <span className="font-bold text-espresso">{time}</span>;
  // Only live-check items are checked after publishing; anything else simply has no time yet.
  if (data.status === "at_live_check") return <span className="text-ink-4">After publish</span>;
  return (
    <span className="text-ink-4">
      <span aria-hidden="true">–</span>
      <span className="sr-only">No time yet</span>
    </span>
  );
};

function resultCell(brandName: string, words: ChecklistWords) {
  const ResultCell = ({ data }: ICellRendererParams<ItemView>) =>
    data ? (
      <div className="flex h-full flex-col items-start justify-center gap-0.5">
        <StatusChip status={data.status} brandName={brandName} label={words.status(data)} />
        {data.change && <span className="text-label font-semibold text-ink-3">{data.change}</span>}
      </div>
    ) : null;
  return ResultCell;
}

/**
 * The checklist as an AG Grid table, for `md:` and up; phones get item cards
 * from the same items (DC-FR-41). Selecting a row selects the item everywhere.
 * Under 1000px of grid width the Kind and Brief columns drop out, so nothing
 * scrolls sideways. Loaded only on larger screens.
 *
 * @param items - the checklist items to show
 * @param brandName - the deal's brand, for result words
 * @param selectedId - the selected item, or null
 * @param onSelect - called with the item the creator clicks, or picks with Enter or Space
 * @param wide - force the wide column set (tests); measured from the grid otherwise
 * @see docs/specs/creator-draft-check-frd.md DC-FR-40, DC-FR-41, DC-FR-22
 */
export default function ChecklistGrid({
  items,
  brandName,
  selectedId,
  onSelect,
  wide: wideOverride,
}: {
  items: ItemView[];
  brandName: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  wide?: boolean;
}) {
  const words = useChecklistWords(brandName);
  const [measuredWide, setMeasuredWide] = useState(true);
  const wide = wideOverride ?? measuredWide;
  const gridRef = useRef<AgGridReact<ItemView>>(null);

  const columnDefs = useMemo<ColDef<ItemView>[]>(() => {
    const order = (s: ItemStatus) => NEED_ORDER.indexOf(s);
    const cols: (ColDef<ItemView> & { wideOnly?: boolean })[] = [
      { colId: "seal", headerName: "Status", headerComponent: SealHeader, width: 64, sortable: false, cellRenderer: SealCell },
      { colId: "item", headerName: "Item", field: "name", flex: 3, minWidth: 280, cellRenderer: ItemCell },
      { colId: "kind", headerName: "Kind", field: "kind", width: 140, valueFormatter: (p) => kindLabel(p.value), wideOnly: true },
      { colId: "time", headerName: "Time", width: 128, valueGetter: (p) => p.data?.evidence?.startSec ?? Infinity, cellRenderer: TimeCell },
      { colId: "brief", headerName: "Brief", width: 96, valueGetter: (p) => p.data?.briefLine?.number, valueFormatter: (p) => (p.value ? `Line ${p.value}` : words.addedBy), wideOnly: true },
      {
        colId: "result",
        headerName: "Result",
        field: "status",
        width: 240,
        cellRenderer: resultCell(brandName, words),
        comparator: (a: ItemStatus, b: ItemStatus) => order(a) - order(b),
      },
    ];
    return cols.filter((c) => wide || !c.wideOnly).map(({ wideOnly, ...c }) => (void wideOnly, c));
  }, [brandName, wide, words]);

  // DC-FR-40: measure the grid's own width from the start (it can sit in a column, as on the brand's review).
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setMeasuredWide(entry.contentRect.width >= WIDE_MIN_PX));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep the grid's selected row in step with the page's selection (DC-FR-22).
  useEffect(() => {
    gridRef.current?.api?.forEachNode((node) => node.setSelected(node.data?.id === selectedId));
  }, [selectedId, items]);

  return (
    <div ref={boxRef}>
    <AgGridReact<ItemView>
      ref={gridRef}
      theme={theme}
      rowData={items}
      columnDefs={columnDefs}
      getRowId={(p) => p.data.id}
      domLayout="autoHeight"
      suppressColumnVirtualisation
      defaultColDef={{ sortable: true, resizable: false, suppressMovable: true }}
      rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
      rowClassRules={{ "row-fail": (p) => p.data?.status === "fix_needed" }}
      onRowClicked={(e) => e.data && onSelect(e.data.id)}
      // One Tab stop: Tab leaves the grid instead of visiting every cell; arrows move inside it.
      tabToNextCell={() => false}
      tabToNextHeader={() => false}
      // Keyboard: arrows move between rows, Enter or Space selects (DC-FR-22).
      onCellKeyDown={(e) => {
        const event = e.event as KeyboardEvent | null | undefined;
        if (!e.data || (event?.key !== "Enter" && event?.key !== " ")) return;
        event.preventDefault();
        onSelect(e.data.id);
      }}
      onFirstDataRendered={(e) => e.api.forEachNode((node) => node.setSelected(node.data?.id === selectedId))}
      onGridSizeChanged={(e) => setMeasuredWide(e.clientWidth >= WIDE_MIN_PX)}
    />
    </div>
  );
}
