"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Heart, Pencil, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cycleApi, settingsApi, type CycleRecord, type CycleForecast } from "@/lib/api";

function daysLabel(dateStr: string, today: string): string {
  const diff = Math.round(
    (new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000
  );
  if (diff === 0) return "今天";
  if (diff > 0) return `${diff} 天後`;
  return `已過 ${Math.abs(diff)} 天`;
}

function fmt(dateStr: string): string {
  return dateStr.substring(5).replace("-", "/");
}

function CalendarView({ forecast, today }: { forecast: CycleForecast; today: string }) {
  const [ym, setYm] = useState(today.substring(0, 7));
  const year = parseInt(ym.substring(0, 4));
  const month = parseInt(ym.substring(5, 7));

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function ds(d: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const f = forecast;
  const DOW = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-slate-700">
          {year} 年 {month} 月
        </span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-xs text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;

          const date = ds(d);
          const isToday = date === today;
          const isOvulation = f.has_data && date === f.ovulation;
          const isNextPeriodStart = f.has_data && date === f.next_period;

          const inCurrentPeriod =
            f.has_data && f.last_period && f.period_end &&
            date >= f.last_period && date <= f.period_end;
          const inNextPeriod =
            f.has_data && f.next_period && f.next_period_end &&
            date >= f.next_period && date <= f.next_period_end;
          const inFertile =
            f.has_data && f.fertile_start && f.fertile_end &&
            date >= f.fertile_start && date <= f.fertile_end;

          const isFirstCurrentPeriod = f.has_data && date === f.last_period;
          const isLastCurrentPeriod  = f.has_data && date === f.period_end;
          const isFirstNextPeriod    = f.has_data && date === f.next_period;
          const isLastNextPeriod     = f.has_data && date === f.next_period_end;
          const isFirstFertile = f.has_data && date === f.fertile_start;
          const isLastFertile  = f.has_data && date === f.fertile_end;

          let cellBg = "";
          let textColor = "text-slate-700";
          let circleClass = "";

          // Priority: ovulation circle > next-period-start circle > fertile band > period band
          if (isOvulation) {
            circleClass = "bg-pink-400 text-white rounded-full";
            if (inFertile) cellBg = "bg-emerald-100";
          } else if (isNextPeriodStart) {
            circleClass = "bg-violet-400 text-white rounded-full";
            if (inNextPeriod) {
              const r = isLastNextPeriod ? "rounded-r-full" : "";
              cellBg = `bg-rose-100 ${r}`;
            }
          } else if (inFertile) {
            const r = isFirstFertile ? "rounded-l-full" : isLastFertile ? "rounded-r-full" : "";
            cellBg = `bg-emerald-100 ${r}`;
            textColor = "text-emerald-800";
          } else if (inCurrentPeriod) {
            const r = isFirstCurrentPeriod ? "rounded-l-full" : isLastCurrentPeriod ? "rounded-r-full" : "";
            cellBg = `bg-rose-100 ${r}`;
            textColor = "text-rose-700";
          } else if (inNextPeriod) {
            const r = isFirstNextPeriod ? "rounded-l-full" : isLastNextPeriod ? "rounded-r-full" : "";
            cellBg = `bg-rose-100 ${r}`;
            textColor = "text-rose-500";
          }

          return (
            <div
              key={i}
              className={`relative flex items-center justify-center h-8 ${cellBg}`}
            >
              <div
                className={`w-7 h-7 flex items-center justify-center text-xs font-medium
                  ${circleClass || textColor}
                  ${isToday && !circleClass ? "ring-2 ring-blue-400 rounded-full" : ""}
                `}
              >
                {d}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3.5 h-3.5 rounded-sm bg-rose-100 border border-rose-200" />
          月經期
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-100 border border-emerald-300" />
          易孕期
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3.5 h-3.5 rounded-full bg-pink-400" />
          排卵日
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3.5 h-3.5 rounded-full bg-violet-400" />
          預計月經
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3.5 h-3.5 rounded-full ring-2 ring-blue-400" />
          今天
        </div>
      </div>
    </div>
  );
}

export default function CyclePage() {
  const { data: records, isLoading, mutate } = useSWR(
    "cycle_records",
    () => cycleApi.list(),
    { shouldRetryOnError: false }
  );
  const { data: forecast, mutate: mutateForecast } = useSWR<CycleForecast>(
    "cycle_forecast",
    () => cycleApi.forecast(),
    { shouldRetryOnError: false }
  );

  const today = forecast?.today ?? new Date().toISOString().substring(0, 10);

  const [addDate, setAddDate] = useState(today);
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const [cycleInput, setCycleInput] = useState<string>("");
  const [editingCycle, setEditingCycle] = useState(false);
  const [savingCycle, setSavingCycle] = useState(false);

  const [periodInput, setPeriodInput] = useState<string>("");
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);

  async function handleSaveCycle() {
    const v = parseInt(cycleInput);
    if (!v || v < 21 || v > 45) return;
    setSavingCycle(true);
    await settingsApi.update("cycle_default_length", String(v));
    await mutateForecast();
    setEditingCycle(false);
    setSavingCycle(false);
  }

  async function handleSavePeriod() {
    const v = parseInt(periodInput);
    if (!v || v < 1 || v > 14) return;
    setSavingPeriod(true);
    await settingsApi.update("period_default_length", String(v));
    await mutateForecast();
    setEditingPeriod(false);
    setSavingPeriod(false);
  }

  async function handleAdd() {
    if (!addDate) return;
    setSaving(true);
    await cycleApi.create(addDate, addNotes || undefined);
    setAddDate(today);
    setAddNotes("");
    await mutate();
    await mutateForecast();
    setSaving(false);
  }

  function startEdit(r: CycleRecord) {
    setEditingId(r.id);
    setEditNotes(r.notes ?? "");
  }

  async function handleUpdate(id: number) {
    await cycleApi.update(id, { notes: editNotes || undefined });
    setEditingId(null);
    await mutate();
    await mutateForecast();
  }

  async function handleDelete(id: number) {
    await cycleApi.remove(id);
    await mutate();
    await mutateForecast();
  }

  const f = forecast;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">排卵期計算</h1>
        <p className="mt-1 text-sm text-slate-500">
          Telegram 指令：
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">來了</code> 記錄、
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs ml-1">週期</code> 預測、
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs ml-1">歷史</code> 查詢
        </p>
      </div>

      {/* Cycle settings card */}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl mb-6 divide-y divide-slate-100">
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-sm text-slate-600 flex-1">月經週期</span>
            {editingCycle ? (
              <>
                <input
                  type="number"
                  value={cycleInput}
                  onChange={(e) => setCycleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCycle()}
                  min={21}
                  max={45}
                  autoFocus
                  className="w-20 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400"
                />
                <span className="text-sm text-slate-500">天</span>
                <button onClick={handleSaveCycle} disabled={savingCycle} className="w-7 h-7 flex items-center justify-center rounded-lg bg-pink-500 hover:bg-pink-600 text-white transition-colors disabled:opacity-40">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingCycle(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-800">{f.default_cycle} 天</span>
                <button onClick={() => { setCycleInput(String(f.default_cycle)); setEditingCycle(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-pink-50 text-slate-400 hover:text-pink-500 transition-colors">
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-sm text-slate-600 flex-1">月經天數</span>
            {editingPeriod ? (
              <>
                <input
                  type="number"
                  value={periodInput}
                  onChange={(e) => setPeriodInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSavePeriod()}
                  min={1}
                  max={14}
                  autoFocus
                  className="w-20 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
                />
                <span className="text-sm text-slate-500">天</span>
                <button onClick={handleSavePeriod} disabled={savingPeriod} className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-40">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingPeriod(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-800">{f.period_length} 天</span>
                <button onClick={() => { setPeriodInput(String(f.period_length)); setEditingPeriod(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Forecast stat cards */}
      {f?.has_data && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <div className="text-sm font-medium text-slate-500 mb-3">
            週期預測（平均 {f.avg_cycle} 天）
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">今天</div>
              <div className="text-xl font-bold text-slate-800">第 {f.current_day} 天</div>
              <div className="text-xs text-slate-400 mt-1">上次 {fmt(f.last_period!)}</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-xs text-pink-500 mb-1">排卵日</div>
              <div className="text-xl font-bold text-pink-600">{fmt(f.ovulation!)}</div>
              <div className="text-xs text-pink-400 mt-1">{daysLabel(f.ovulation!, today)}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-xs text-emerald-500 mb-1">易孕期</div>
              <div className="text-sm font-bold text-emerald-700 mt-1 leading-snug">
                {fmt(f.fertile_start!)}<br />~ {fmt(f.fertile_end!)}
              </div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="text-xs text-violet-500 mb-1">下次月經</div>
              <div className="text-xl font-bold text-violet-600">{fmt(f.next_period!)}</div>
              <div className="text-xs text-violet-400 mt-1">{daysLabel(f.next_period!, today)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      {f?.has_data && <CalendarView forecast={f} today={today} />}

      {/* Add Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="text-sm font-medium text-slate-700 mb-3">記錄月經開始日</div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="date"
            value={addDate}
            onChange={(e) => setAddDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 transition"
          />
          <input
            value={addNotes}
            onChange={(e) => setAddNotes(e.target.value)}
            placeholder="症狀備註（選填）"
            className="flex-1 min-w-[150px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 transition"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !addDate}
            className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            {saving ? "記錄中..." : "記錄"}
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
        {records?.map((r) => {
          const isEditing = editingId === r.id;
          return (
            <div
              key={r.id}
              className={`bg-white border rounded-xl px-4 py-3.5 ${
                isEditing ? "border-pink-300 ring-1 ring-pink-200" : "border-slate-200"
              }`}
            >
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-semibold text-slate-700">{r.start_date}</div>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="症狀備註"
                      className="flex-1 min-w-[150px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                    />
                    <button
                      onClick={() => handleUpdate(r.id)}
                      className="px-3 py-1.5 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                    <Heart size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800">{r.start_date}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {[
                        r.cycle_length ? `週期 ${r.cycle_length} 天` : null,
                        r.notes,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "無備註"}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(r)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-pink-50 text-slate-400 hover:text-pink-500 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && records?.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Heart size={36} className="mx-auto mb-3 opacity-40" />
          <div className="text-sm">還沒有記錄，先新增第一筆月經開始日吧！</div>
        </div>
      )}
    </div>
  );
}
