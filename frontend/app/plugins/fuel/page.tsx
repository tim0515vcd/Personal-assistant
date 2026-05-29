"use client";
import { useState } from "react";
import useSWR from "swr";
import { Trash2, Plus, Fuel, Pencil, X, ChevronLeft, ChevronRight, Download, Check, Star } from "lucide-react";
import { fuelApi, carApi, type FuelRecord, type Car } from "@/lib/api";

const PER_PAGE = 10;

function today() {
  return new Date().toISOString().split("T")[0];
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg py-3 text-center ${highlight ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      <div className={`text-xl font-bold ${highlight ? "text-emerald-700" : "text-slate-800"}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${highlight ? "text-emerald-600" : "text-slate-500"}`}>{label}</div>
    </div>
  );
}

function TrendChart({ records }: { records: FuelRecord[] }) {
  const points = [...records].filter((r) => r.efficiency !== null).reverse();
  if (points.length < 2) return null;
  const effs = points.map((r) => r.efficiency!);
  const minE = Math.min(...effs);
  const maxE = Math.max(...effs);
  const range = maxE - minE || 1;
  const W = 600; const H = 120; const PAD = 24;
  const cx = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const cy = (v: number) => H - PAD - ((v - minE) / range) * (H - PAD * 2);
  const polyline = points.map((p, i) => `${cx(i)},${cy(p.efficiency!)}`).join(" ");
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="text-sm font-medium text-slate-700 mb-3">油耗趨勢（km/L）</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD - 4} y={PAD + t * (H - PAD * 2) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {(maxE - t * range).toFixed(1)}
            </text>
          </g>
        ))}
        <polyline points={polyline} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={cx(i)} cy={cy(p.efficiency!)} r="3.5" fill="#f97316" />
        ))}
      </svg>
    </div>
  );
}

function MonthlyCost({ records }: { records: FuelRecord[] }) {
  const monthly = records.reduce((acc, r) => {
    const m = r.date.substring(0, 7);
    acc[m] = (acc[m] || 0) + r.cost;
    return acc;
  }, {} as Record<string, number>);
  const sorted = Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  if (sorted.length === 0) return null;
  const maxCost = Math.max(...sorted.map(([, c]) => c));
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="text-sm font-medium text-slate-700 mb-3">每月油費（近 6 個月）</div>
      <div className="flex flex-col gap-2">
        {sorted.map(([month, cost]) => (
          <div key={month} className="flex items-center gap-3">
            <div className="text-xs text-slate-500 w-16 shrink-0">{month}</div>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="bg-orange-400 h-2 rounded-full" style={{ width: `${(cost / maxCost) * 100}%` }} />
            </div>
            <div className="text-xs font-medium text-slate-700 w-16 text-right shrink-0">${cost.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function efficiencyBadge(eff: number | null) {
  if (eff === null) return null;
  if (eff >= 12) return { label: `${eff} km/L`, badge: "bg-emerald-100 text-emerald-700" };
  if (eff >= 9)  return { label: `${eff} km/L`, badge: "bg-amber-100 text-amber-700" };
  return { label: `${eff} km/L`, badge: "bg-red-100 text-red-700" };
}

// ── Car tabs ─────────────────────────────────────────────────

function CarTabs({
  cars,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onSetDefault,
}: {
  cars: Car[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function startEdit(car: Car) {
    setEditingId(car.id);
    setEditName(car.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(car: Car) {
    if (!editName.trim()) return;
    await onRename(car.id, editName.trim());
    cancelEdit();
  }

  async function saveNew() {
    if (!newName.trim()) return;
    await onAdd(newName.trim());
    setNewName("");
    setAdding(false);
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 items-center">
        {cars.map((car) =>
          editingId === car.id ? (
            <div key={car.id} className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(car); if (e.key === "Escape") cancelEdit(); }}
                className="text-sm outline-none bg-transparent w-24 text-slate-800"
              />
              <button onClick={() => saveEdit(car)} className="text-emerald-600 hover:text-emerald-700" title="儲存">
                <Check size={14} />
              </button>
              <button
                onClick={() => onSetDefault(car.id)}
                className={`${car.is_default ? "text-orange-500" : "text-slate-300 hover:text-orange-400"}`}
                title={car.is_default ? "預設車輛" : "設為預設"}
              >
                <Star size={14} />
              </button>
              <button
                onClick={() => { onDelete(car.id); cancelEdit(); }}
                disabled={car.record_count > 0}
                className="text-slate-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={car.record_count > 0 ? "有記錄無法刪除" : "刪除"}
              >
                <Trash2 size={14} />
              </button>
              <button onClick={cancelEdit} className="text-slate-300 hover:text-slate-500" title="取消">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              key={car.id}
              onClick={() => onSelect(car.id)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
                ${selectedId === car.id
                  ? "bg-orange-100 text-orange-700 border-orange-200"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}
              `}
            >
              {car.is_default && <Star size={11} className="text-orange-400 fill-orange-400" />}
              {car.name}
              <span
                onClick={(e) => { e.stopPropagation(); startEdit(car); }}
                className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="編輯"
              >
                <Pencil size={11} />
              </span>
            </button>
          )
        )}

        {adding ? (
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder="車輛名稱"
              className="text-sm outline-none bg-transparent w-24 text-slate-800 placeholder:text-slate-400"
            />
            <button onClick={saveNew} className="text-emerald-600 hover:text-emerald-700" title="新增"><Check size={14} /></button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="text-slate-300 hover:text-slate-500" title="取消"><X size={14} /></button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Plus size={13} /> 新增車輛
          </button>
        )}
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────

export default function FuelPage() {
  const { data: cars, mutate: mutateCars } = useSWR<Car[]>("fuel_cars", carApi.list);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

  const effectiveCarId =
    selectedCarId ??
    cars?.find((c) => c.is_default)?.id ??
    cars?.[0]?.id ??
    null;

  const { data: allRecords, isLoading, mutate: mutateRecords } = useSWR(
    effectiveCarId !== null ? `fuel_records_${effectiveCarId}` : null,
    () => fuelApi.list(effectiveCarId!),
  );

  const [page, setPage] = useState(1);
  const records = (allRecords ?? []).slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalCount = allRecords?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const [odometer, setOdometer] = useState("");
  const [liters, setLiters] = useState("");
  const [cost, setCost] = useState("");
  const [refuelDate, setRefuelDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  function startEdit(r: FuelRecord) {
    setEditingId(r.id);
    setOdometer(String(r.odometer));
    setLiters(String(r.liters));
    setCost(String(r.cost));
    setRefuelDate(r.date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setOdometer(""); setLiters(""); setCost(""); setRefuelDate(today());
  }

  async function handleSave() {
    if (!odometer || !liters || !cost || effectiveCarId === null) return;
    setSaving(true);
    if (editingId !== null) {
      await fuelApi.update(editingId, { odometer: Number(odometer), liters: Number(liters), cost: Number(cost), date: refuelDate });
      setEditingId(null);
    } else {
      await fuelApi.create(effectiveCarId, Number(odometer), Number(liters), Number(cost), refuelDate);
    }
    setOdometer(""); setLiters(""); setCost(""); setRefuelDate(today());
    await mutateRecords();
    setSaving(false);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    await fuelApi.remove(id);
    await mutateRecords();
    await mutateCars(); // record_count update
    setDeleting(null);
  }

  // Car handlers
  async function handleAddCar(name: string) {
    const newCar = await carApi.create(name);
    await mutateCars();
    setSelectedCarId(newCar.id);
  }

  async function handleRenameCar(id: number, name: string) {
    await carApi.update(id, name);
    await mutateCars();
  }

  async function handleDeleteCar(id: number) {
    await carApi.remove(id);
    if (selectedCarId === id) setSelectedCarId(null);
    await mutateCars();
  }

  async function handleSetDefault(id: number) {
    await carApi.setDefault(id);
    await mutateCars();
  }

  const validRecords = (allRecords ?? []).filter((r) => r.efficiency !== null);
  const avgEff = validRecords.length
    ? Math.round((validRecords.reduce((s, r) => s + r.efficiency!, 0) / validRecords.length) * 10) / 10
    : null;
  const bestEff = validRecords.length ? Math.max(...validRecords.map((r) => r.efficiency!)) : null;
  const totalCost = (allRecords ?? []).reduce((s, r) => s + r.cost, 0);
  const totalDistance = (allRecords ?? []).reduce((s, r) => s + (r.distance ?? 0), 0);
  const costPerKm = totalDistance > 0 ? Math.round((totalCost / totalDistance) * 10) / 10 : null;
  const latestOdo = allRecords?.[0]?.odometer ?? null;

  function exportCSV() {
    if (!allRecords?.length) return;
    const carName = cars?.find((c) => c.id === effectiveCarId)?.name ?? "car";
    const rows = [
      ["日期", "里程(km)", "加油量(L)", "油錢(元)", "行駛距離(km)", "油耗(km/L)"],
      ...[...allRecords].reverse().map((r) => [r.date, r.odometer, r.liters, r.cost, r.distance ?? "", r.efficiency ?? ""]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel_${carName}_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">油耗記錄</h1>
          {!isLoading && totalCount > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Download size={14} />
              匯出 CSV
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Telegram 指令：
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">加油 12500 40 1800</code>
          <span className="mx-1">·</span>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">油耗</code>
        </p>
      </div>

      {cars && cars.length > 0 && (
        <CarTabs
          cars={cars}
          selectedId={effectiveCarId}
          onSelect={setSelectedCarId}
          onAdd={handleAddCar}
          onRename={handleRenameCar}
          onDelete={handleDeleteCar}
          onSetDefault={handleSetDefault}
        />
      )}

      {!isLoading && totalCount > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          <StatCard label="次加油" value={String(totalCount)} />
          {avgEff !== null && <StatCard label="平均 km/L" value={String(avgEff)} />}
          {bestEff !== null && <StatCard label="最佳 km/L" value={String(bestEff)} highlight />}
          {costPerKm !== null && <StatCard label="元/km" value={String(costPerKm)} />}
          {totalDistance > 0 && <StatCard label="總里程 km" value={totalDistance.toLocaleString()} />}
          {totalCost > 0 && <StatCard label="總油費" value={`$${totalCost.toLocaleString()}`} />}
          {latestOdo !== null && <StatCard label="目前里程 km" value={latestOdo.toLocaleString()} />}
        </div>
      )}

      {!isLoading && validRecords.length >= 2 && <TrendChart records={allRecords ?? []} />}
      {!isLoading && totalCount > 0 && <MonthlyCost records={allRecords ?? []} />}

      <div className={`border rounded-xl p-4 mb-6 ${editingId ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-slate-700">{editingId ? "編輯加油記錄" : "新增加油記錄"}</div>
          {editingId && (
            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input value={refuelDate} onChange={(e) => setRefuelDate(e.target.value)} type="date"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition bg-white" />
          <input value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="里程數 (km)" type="number"
            className="flex-1 min-w-[110px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition" />
          <input value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="加油量 (L)" type="number" step="0.1"
            className="flex-1 min-w-[100px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition" />
          <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="油錢 (元)" type="number"
            className="flex-1 min-w-[100px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition" />
          <button onClick={handleSave} disabled={saving || !odometer || !liters || !cost || effectiveCarId === null}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={15} />
            {saving ? "儲存中..." : editingId ? "更新" : "新增"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400 py-4">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
          <span className="text-sm">載入中...</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {records.map((r) => {
          const eff = efficiencyBadge(r.efficiency);
          const isEditing = editingId === r.id;
          return (
            <div key={r.id} className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3.5 ${isEditing ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"}`}>
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <Fuel size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{r.odometer.toLocaleString()} km</span>
                  {eff && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eff.badge}`}>{eff.label}</span>}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {r.date} · {r.liters} L · ${r.cost.toLocaleString()}
                  {r.distance !== null && <span> · 行駛 {r.distance.toLocaleString()} km</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => isEditing ? cancelEdit() : startEdit(r)} title="編輯"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isEditing ? "bg-amber-100 text-amber-600" : "bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-500"}`}>
                  {isEditing ? <X size={15} /> : <Pencil size={15} />}
                </button>
                <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} title="刪除"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && totalCount === 0 && effectiveCarId !== null && (
        <div className="text-center py-16 text-slate-400">
          <Fuel size={36} className="mx-auto mb-3 opacity-40" />
          <div className="text-sm">這台車還沒有加油記錄，先新增一筆吧！</div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-slate-600">第 {page} 頁，共 {totalPages} 頁</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
