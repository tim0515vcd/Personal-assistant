"use client";
import { useState, useRef } from "react";
import useSWR from "swr";
import { Bell, CloudSun, Fuel, Settings, Heart, GripVertical, LayoutGrid, List, type LucideIcon } from "lucide-react";
import { pluginApi, type Plugin } from "@/lib/api";

const ICONS: Record<string, LucideIcon> = {
  reminder: Bell,
  fuel:     Fuel,
  cycle:    Heart,
  weather:  CloudSun,
  settings: Settings,
};

const COLORS: Record<string, { iconBg: string; iconColor: string; border: string }> = {
  reminder: { iconBg: "bg-violet-100", iconColor: "text-violet-600", border: "border-violet-200" },
  fuel:     { iconBg: "bg-orange-100", iconColor: "text-orange-600", border: "border-orange-200" },
  cycle:    { iconBg: "bg-pink-100",   iconColor: "text-pink-600",   border: "border-pink-200"   },
  weather:  { iconBg: "bg-sky-100",    iconColor: "text-sky-600",    border: "border-sky-200"    },
  settings: { iconBg: "bg-slate-100",  iconColor: "text-slate-600",  border: "border-slate-200"  },
};

function Toggle({ checked, onChange, title }: { checked: boolean; onChange: () => void; title?: string }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(); }}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-emerald-400" : "bg-slate-300"}`}
      title={title}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function Home() {
  const { data: plugins, isLoading, mutate } = useSWR<Plugin[]>(
    "plugins",
    () => pluginApi.list(),
    { shouldRetryOnError: false }
  );

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const draggingIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  async function toggleEnabled(name: string, current: boolean) {
    await pluginApi.setEnabled(name, !current);
    await mutate();
  }

  async function toggleShowNav(name: string, current: boolean) {
    await pluginApi.setShowNav(name, !current);
    await mutate();
  }

  function handleDragStart(idx: number) {
    draggingIdx.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggingIdx.current !== idx) setDragOverIdx(idx);
  }

  async function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = draggingIdx.current;
    draggingIdx.current = null;
    setDragOverIdx(null);
    if (from === null || from === idx) return;

    const next = [...(plugins ?? [])];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);

    await mutate(
      async () => {
        await pluginApi.reorder(next.map((p) => p.name));
        return next;
      },
      { optimisticData: next, rollbackOnError: true }
    );
  }

  function handleDragEnd() {
    draggingIdx.current = null;
    setDragOverIdx(null);
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">已載入的插件</h1>
          <p className="mt-1 text-sm text-slate-500">
            {viewMode === "list"
              ? "拖曳左側把手調整順序；啟用／導覽可分別開關"
              : "點擊卡片進入功能頁面"}
          </p>
        </div>
        <div className="flex gap-1 mt-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
            title="清單檢視"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
            title="格狀檢視"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
          <span className="text-sm">載入中...</span>
        </div>
      )}

      {/* ── 清單模式 ── */}
      {viewMode === "list" && (
        <div className="flex flex-col gap-3">
          {plugins?.map((p, idx) => {
            const meta = COLORS[p.name] ?? COLORS.settings;
            const Icon = ICONS[p.name] ?? CloudSun;
            const isSettings = p.name === "settings";
            const isDragOver = dragOverIdx === idx;

            return (
              <div
                key={p.name}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3.5 transition-all select-none
                  ${isDragOver ? "border-blue-400 ring-2 ring-blue-100" : p.enabled ? meta.border : "border-slate-200"}
                  ${!p.enabled ? "opacity-50" : ""}
                `}
              >
                <div
                  className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors shrink-0"
                  title="拖曳排序"
                >
                  <GripVertical size={18} />
                </div>

                <a
                  href={p.nav_path || "#"}
                  onClick={(e) => !p.nav_path && e.preventDefault()}
                  className="flex items-center gap-3 flex-1 min-w-0 no-underline"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${p.enabled ? `${meta.iconBg} ${meta.iconColor}` : "bg-slate-100 text-slate-400"}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 text-sm">{p.display || p.name}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{p.description}</div>
                  </div>
                  <div className="text-xs text-slate-300 shrink-0">v{p.version}</div>
                </a>

                <div className="flex items-center gap-3 shrink-0">
                  {!isSettings && (
                    <>
                      <div className="flex flex-col items-center gap-0.5">
                        <Toggle
                          checked={p.show_nav}
                          onChange={() => toggleShowNav(p.name, p.show_nav)}
                          title={p.show_nav ? "從導覽列移除" : "顯示於導覽列"}
                        />
                        <span className="text-[10px] text-slate-400">導覽</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Toggle
                          checked={p.enabled}
                          onChange={() => toggleEnabled(p.name, p.enabled)}
                          title={p.enabled ? "停用" : "啟用"}
                        />
                        <span className="text-[10px] text-slate-400">啟用</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 格狀模式 ── */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 gap-3">
          {plugins?.map((p) => {
            const meta = COLORS[p.name] ?? COLORS.settings;
            const Icon = ICONS[p.name] ?? CloudSun;
            const isSettings = p.name === "settings";

            return (
              <a
                key={p.name}
                href={p.nav_path || "#"}
                onClick={(e) => !p.nav_path && e.preventDefault()}
                className={`flex items-start gap-3 bg-white border rounded-xl px-4 py-3.5 no-underline transition-all select-none
                  ${p.enabled ? `${meta.border} hover:shadow-sm` : "border-slate-200 opacity-50 cursor-default"}
                `}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${p.enabled ? `${meta.iconBg} ${meta.iconColor}` : "bg-slate-100 text-slate-400"}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-sm">{p.display || p.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{p.description}</div>
                  <div className="text-xs text-slate-300 mt-0.5">v{p.version}</div>
                </div>
                {!isSettings && (
                  <Toggle
                    checked={p.enabled}
                    onChange={() => toggleEnabled(p.name, p.enabled)}
                    title={p.enabled ? "停用" : "啟用"}
                  />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
