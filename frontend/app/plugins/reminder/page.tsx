"use client";
import { useState } from "react";
import useSWR from "swr";
import { Check, Trash2, Plus, Bell, Pencil, X } from "lucide-react";
import { reminderApi, type ReminderItem } from "@/lib/api";

const fetcher = () => reminderApi.list();

function statusInfo(m: ReminderItem) {
  if (m.target_count > 1) {
    const done = m.current_count >= m.target_count;
    return {
      label: `${m.current_count}/${m.target_count} 次`,
      badge: done
        ? "bg-emerald-100 text-emerald-700"
        : m.current_count > 0
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700",
      ring: done ? "" : m.current_count > 0 ? "ring-1 ring-amber-200" : "ring-1 ring-red-200",
    };
  }
  if (m.is_overdue) {
    return {
      label: m.days_since === null ? "從未完成" : `${m.days_since} 天未完成`,
      badge: "bg-red-100 text-red-700",
      ring: "ring-1 ring-red-200",
    };
  }
  const remaining = m.freq_days - (m.days_since ?? 0);
  if (remaining <= 1) {
    return { label: "快到了", badge: "bg-amber-100 text-amber-700", ring: "ring-1 ring-amber-200" };
  }
  return { label: `${remaining} 天後`, badge: "bg-emerald-100 text-emerald-700", ring: "" };
}

const FREQ_OPTIONS = [1, 3, 7, 14, 30, 90, 180, 365];
const FREQ_LABELS: Record<number, string> = {
  1: "每天", 3: "每 3 天", 7: "每週", 14: "每 2 週",
  30: "每月", 90: "每季", 180: "每半年", 365: "每年",
};

export default function ReminderPage() {
  const { data: items, isLoading, mutate } = useSWR("reminder_items", fetcher);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [freqDays, setFreqDays] = useState(7);
  const [targetCount, setTargetCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [doing, setDoing] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  function startEdit(m: ReminderItem) {
    setEditingId(m.id);
    setName(m.name);
    setCategory(m.category ?? "");
    setFreqDays(FREQ_OPTIONS.includes(m.freq_days) ? m.freq_days : 7);
    setTargetCount(m.target_count);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setCategory("");
    setFreqDays(7);
    setTargetCount(1);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (editingId !== null) {
      await reminderApi.update(editingId, {
        freq_days: freqDays,
        category: category.trim() || undefined,
        target_count: targetCount,
      });
      setEditingId(null);
    } else {
      await reminderApi.create(name.trim(), freqDays, category.trim() || undefined, targetCount);
    }
    setName("");
    setCategory("");
    setFreqDays(7);
    setTargetCount(1);
    await mutate();
    setSaving(false);
  }

  async function handleDone(id: number) {
    setDoing(id);
    await reminderApi.done(id);
    await mutate();
    setDoing(null);
  }

  async function handleDelete(id: number) {
    await reminderApi.remove(id);
    await mutate();
  }

  const sorted = [...(items ?? [])].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    return (b.days_since ?? 999) - (a.days_since ?? 999);
  });

  const overdueCount = sorted.filter((m) => m.is_overdue).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">排程提醒</h1>
        <p className="mt-1 text-sm text-slate-500">
          Telegram 指令：
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">提醒</code> 查看、
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs ml-1">完成 媽媽</code> 標記完成
        </p>
      </div>

      {!isLoading && sorted.length > 0 && (
        <div className="flex gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-center min-w-[80px]">
            <div className="text-2xl font-bold text-slate-800">{sorted.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">總計</div>
          </div>
          {overdueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center min-w-[80px]">
              <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
              <div className="text-xs text-red-500 mt-0.5">待完成</div>
            </div>
          )}
        </div>
      )}

      <div className={`border rounded-xl p-4 mb-6 ${editingId ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-slate-700">{editingId ? "編輯提醒項目" : "新增提醒項目"}</div>
          {editingId && (
            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="名稱（例：媽媽、車輛保養）"
            disabled={!!editingId}
            className="flex-1 min-w-[150px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition disabled:bg-slate-50 disabled:text-slate-400"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="分類（選填）"
            className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition"
          />
          <select
            value={freqDays}
            onChange={(e) => setFreqDays(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition bg-white"
          >
            {FREQ_OPTIONS.map((d) => (
              <option key={d} value={d}>{FREQ_LABELS[d]}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <span className="text-xs text-slate-500 whitespace-nowrap">需完成</span>
            <input
              type="number"
              min={1}
              max={99}
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value)))}
              className="w-10 text-sm text-center outline-none focus:ring-2 focus:ring-violet-300 rounded"
            />
            <span className="text-xs text-slate-500">次</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
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
        {sorted.map((m) => {
          const s = statusInfo(m);
          const isEditing = editingId === m.id;
          const isDone = m.target_count > 1
            ? m.current_count >= m.target_count
            : !m.is_overdue && m.days_since === 0;
          return (
            <div
              key={m.id}
              className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3.5 ${isEditing ? "border-amber-400 ring-1 ring-amber-200" : `border-slate-200 ${s.ring}`}`}
            >
              <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-semibold text-base shrink-0">
                {m.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{m.name}</span>
                  {m.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{m.category}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {m.target_count > 1
                    ? `每 ${m.freq_days} 天 · 目標 ${m.target_count} 次`
                    : `每 ${m.freq_days} 天 · ${m.days_since === null ? "從未完成" : m.days_since === 0 ? "今天已完成" : `${m.days_since} 天前`}`
                  }
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleDone(m.id)}
                  disabled={doing === m.id || isDone}
                  title={isDone ? "本週期已完成" : "標記完成一次"}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${isDone ? "bg-emerald-100 text-emerald-600 cursor-default" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"}`}
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => isEditing ? cancelEdit() : startEdit(m)}
                  title="編輯"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isEditing ? "bg-amber-100 text-amber-600" : "bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-500"}`}
                >
                  {isEditing ? <X size={15} /> : <Pencil size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  title="移除"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && sorted.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Bell size={36} className="mx-auto mb-3 opacity-40" />
          <div className="text-sm">還沒有提醒項目，先新增一筆吧！</div>
        </div>
      )}
    </div>
  );
}
