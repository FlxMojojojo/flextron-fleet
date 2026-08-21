import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
  createColumnHelper, type SortingState,
} from '@tanstack/react-table';
import {
  Search, Bike, Wifi, BatteryCharging, AlertTriangle, PowerOff,
  ArrowUp, ArrowDown, ChevronRight, PanelRightClose, PanelRightOpen, MapIcon,
} from 'lucide-react';
import { getVehicles } from '../../api/client';
import { FleetMap } from './FleetMap';
import { cn } from '../../lib/cn';
import type { VehicleState, VehicleStatus } from '../../types/telemetry';

/* ── formatting ─────────────────────────────────────────── */

function fmtLast(ts: number): string {
  return new Date(ts).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function relLast(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── status visuals ─────────────────────────────────────── */

const STATUS: Record<VehicleStatus, { label: string; dot: string; text: string; rank: number }> = {
  alert:    { label: 'Alert',    dot: 'bg-warn',    text: 'text-warn',    rank: 0 },
  charging: { label: 'Charging', dot: 'bg-blue',    text: 'text-blue',    rank: 1 },
  ok:       { label: 'Online',   dot: 'bg-good',    text: 'text-good',    rank: 2 },
  offline:  { label: 'Offline',  dot: 'bg-faint',   text: 'text-faint',   rank: 3 },
};

function socColor(soc: number) {
  return soc < 20 ? 'bg-warn' : soc < 50 ? 'bg-[#E5A800]' : 'bg-good';
}

/* ── columns ────────────────────────────────────────────── */

const col = createColumnHelper<VehicleState>();

const columns = [
  col.accessor('status', {
    header: 'Status',
    sortingFn: (a, b) => STATUS[a.original.status].rank - STATUS[b.original.status].rank,
    cell: info => {
      const s = STATUS[info.getValue()];
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium', s.text)}>
          <span className={cn('size-1.5 rounded-full', s.dot, info.getValue() === 'alert' && 'animate-pulse')} />
          {s.label}
        </span>
      );
    },
  }),
  col.accessor('vehicleno', {
    header: 'Device',
    cell: info => (
      <span className="font-display text-[13px] font-semibold text-ink">{info.getValue()}</span>
    ),
  }),
  col.accessor(v => v.owner?.name ?? '', {
    id: 'owner',
    header: 'Owner',
    cell: info => {
      const o = info.row.original.owner;
      if (!o) return <span className="text-[12px] text-faint">—</span>;
      return (
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink">
          <span className="truncate max-w-[140px]">{o.name}</span>
          <span className="rounded bg-surf1 px-1 font-mono text-[10px] font-semibold text-muted">{o.vehicle_type}</span>
        </span>
      );
    },
  }),
  col.accessor(v => v.can.soc, {
    id: 'soc',
    header: 'SOC',
    cell: info => {
      const soc = info.getValue();
      return (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-hair">
            <span className={cn('block h-full rounded-full', socColor(soc))} style={{ width: `${soc}%` }} />
          </span>
          <span className="font-mono text-[12px] tabular-nums text-ink">{soc.toFixed(0)}%</span>
        </span>
      );
    },
  }),
  col.accessor('cell_delta', {
    header: 'Cell Δ',
    cell: info => (
      <span className={cn('font-mono text-[12px] tabular-nums', info.getValue() > 0.1 ? 'font-semibold text-warn' : 'text-muted')}>
        {info.getValue().toFixed(3)}V
      </span>
    ),
  }),
  col.accessor('last_seen', {
    header: 'Last update',
    cell: info => (
      <span className="font-mono text-[11.5px] tabular-nums text-muted" title={new Date(info.getValue()).toLocaleString()}>
        {fmtLast(info.getValue())}
        <span className="ml-1.5 text-faint">· {relLast(info.getValue())}</span>
      </span>
    ),
  }),
  col.display({
    id: 'open',
    header: '',
    cell: () => <ChevronRight className="size-3.5 text-faint" aria-hidden />,
  }),
];

/* ── KPI filter segments ────────────────────────────────── */

type Seg = 'all' | VehicleStatus;

const SEGS: { key: Seg; label: string; icon: typeof Bike; tone: string; activeTone: string }[] = [
  { key: 'all',      label: 'Total',    icon: Bike,            tone: 'text-ink',   activeTone: 'bg-ink text-white' },
  { key: 'ok',       label: 'Online',   icon: Wifi,            tone: 'text-good',  activeTone: 'bg-good text-white' },
  { key: 'charging', label: 'Charging', icon: BatteryCharging, tone: 'text-blue',  activeTone: 'bg-blue text-white' },
  { key: 'alert',    label: 'Alerts',   icon: AlertTriangle,   tone: 'text-warn',  activeTone: 'bg-warn text-white' },
  { key: 'offline',  label: 'Offline',  icon: PowerOff,        tone: 'text-faint', activeTone: 'bg-navy text-white' },
];

/* ── screen ─────────────────────────────────────────────── */

export function FleetOverview() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [seg, setSeg] = useState<Seg>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'status', desc: false }]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(() => localStorage.getItem('fleet_map_open') !== '0');
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { data: vehicles = [], isLoading } = useQuery<VehicleState[]>({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 3000,
  });

  const counts = useMemo(() => ({
    all: vehicles.length,
    ok: vehicles.filter(v => v.status === 'ok').length,
    charging: vehicles.filter(v => v.status === 'charging').length,
    alert: vehicles.filter(v => v.status === 'alert').length,
    offline: vehicles.filter(v => v.status === 'offline').length,
  }), [vehicles]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter(v => {
      if (seg !== 'all' && v.status !== seg) return false;
      if (!q) return true;
      return v.vehicleno.toLowerCase().includes(q)
        || (v.owner?.name.toLowerCase().includes(q) ?? false)
        || (v.owner?.mobile.includes(q) ?? false);
    });
  }, [vehicles, seg, search]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedIds = table.getRowModel().rows.map(r => r.original.vehicleno);

  /* keyboard: "/" focuses search; arrows move selection; Enter opens */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (typing && el !== searchRef.current) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (sortedIds.length === 0) return;
        const i = selected ? sortedIds.indexOf(selected) : -1;
        const next = e.key === 'ArrowDown' ? Math.min(i + 1, sortedIds.length - 1) : Math.max(i - 1, 0);
        setSelected(sortedIds[next]);
        tableRef.current?.querySelector(`[data-veh="${sortedIds[next]}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && selected && !typing) {
        navigate(`/bike/${selected}`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sortedIds, selected, navigate]);

  function toggleMap() {
    setMapOpen(o => { localStorage.setItem('fleet_map_open', o ? '0' : '1'); return !o; });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col font-body md:flex-row">
      {/* ── Left: toolbar + table ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-hair px-3 py-2">
          <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
            {SEGS.map(sg => {
              const Icon = sg.icon;
              const active = seg === sg.key;
              const n = counts[sg.key];
              return (
                <button
                  key={sg.key}
                  aria-pressed={active}
                  onClick={() => setSeg(active && sg.key !== 'all' ? 'all' : sg.key)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hair px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                    active ? cn(sg.activeTone, 'border-transparent') : cn('bg-white hover:bg-surf2', sg.tone),
                    n === 0 && sg.key !== 'all' && !active && 'opacity-45',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span className="font-mono tabular-nums font-semibold">{n}</span>
                  <span className="hidden lg:inline">{sg.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative ml-auto w-full max-w-60 min-w-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search device, owner, mobile"
              aria-label="Search devices"
              className="h-8 w-full rounded-md border border-hair bg-surf2 pl-8 pr-8 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-blue focus:ring-2 focus:ring-blue/15"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-hair bg-white px-1 font-mono text-[10px] text-faint">/</kbd>
          </div>

          <button
            onClick={toggleMap}
            className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surf2 md:inline-flex"
            aria-pressed={mapOpen}
            title={mapOpen ? 'Hide map' : 'Show map'}
          >
            {mapOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
            Map
          </button>
        </div>

        {/* Table */}
        <div ref={tableRef} className="min-h-0 flex-1 overflow-auto" role="listbox" aria-label="Fleet devices">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-hair)]">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : 'none'}
                      className={cn(
                        'select-none px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted',
                        h.column.getCanSort() && 'cursor-pointer hover:text-ink',
                        h.column.id === 'owner' && 'hidden sm:table-cell',
                        h.column.id === 'cell_delta' && 'hidden xl:table-cell',
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' && <ArrowUp className="size-3" />}
                        {h.column.getIsSorted() === 'desc' && <ArrowDown className="size-3" />}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(r => {
                const v = r.original;
                const isSel = selected === v.vehicleno;
                return (
                  <tr
                    key={v.vehicleno}
                    data-veh={v.vehicleno}
                    role="option"
                    aria-selected={isSel}
                    onClick={() => setSelected(v.vehicleno)}
                    onDoubleClick={() => navigate(`/bike/${v.vehicleno}`)}
                    className={cn(
                      'cursor-pointer border-b border-surf1 transition-colors',
                      isSel ? 'bg-surf1' : 'hover:bg-surf2',
                      v.status === 'alert' && 'shadow-[inset_2px_0_0_var(--color-warn)]',
                    )}
                  >
                    {r.getVisibleCells().map(c => (
                      <td
                        key={c.id}
                        onClick={c.column.id === 'open' || c.column.id === 'vehicleno'
                          ? (e) => { e.stopPropagation(); navigate(`/bike/${v.vehicleno}`); }
                          : undefined}
                        className={cn(
                          'px-3 py-[7px] whitespace-nowrap',
                          c.column.id === 'owner' && 'hidden sm:table-cell',
                          c.column.id === 'cell_delta' && 'hidden xl:table-cell',
                          c.column.id === 'open' && 'w-8 text-right',
                        )}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!isLoading && rows.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-14 text-center">
              <p className="text-[13px] font-medium text-ink">No devices match</p>
              <p className="text-[12px] text-faint">
                {seg !== 'all' ? 'Try clearing the status filter.' : 'Adjust your search.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="hidden items-center gap-3 border-t border-hair px-3 py-1.5 text-[11px] text-faint md:flex">
          <span><kbd className="rounded border border-hair px-1 font-mono">↑↓</kbd> select</span>
          <span><kbd className="rounded border border-hair px-1 font-mono">Enter</kbd> open</span>
          <span><kbd className="rounded border border-hair px-1 font-mono">/</kbd> search</span>
          <span className="ml-auto font-mono tabular-nums">{rows.length}/{vehicles.length} devices</span>
        </div>
      </div>

      {/* ── Right: map panel ── */}
      {mapOpen && (
        <div className="relative h-[46vh] min-h-[280px] border-t border-hair md:h-auto md:w-[42%] md:min-w-[360px] md:border-l md:border-t-0">
          <FleetMap vehicles={vehicles} selectedId={selected} onSelect={id => { setSelected(id); navigate(`/bike/${id}`); }} />
        </div>
      )}
      {!mapOpen && (
        <button
          onClick={toggleMap}
          className="fixed bottom-20 right-4 z-20 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] font-medium text-white shadow-lg md:hidden"
        >
          <MapIcon className="size-3.5" /> Map
        </button>
      )}
    </div>
  );
}
