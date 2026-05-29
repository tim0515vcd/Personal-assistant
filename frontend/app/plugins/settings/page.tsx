"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { Eye, EyeOff, Save, RefreshCw, Check, ChevronDown } from "lucide-react";
import { settingsApi, type SchemaField } from "@/lib/api";

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SchemaField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const base = "border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition bg-white";

  if (field.type === "password") {
    return (
      <div className="relative flex-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.default || ""}
          className={`${base} w-full pr-10 font-mono`}
        />
        <button
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        {field.options.map((o) => (
          <option key={o} value={o}>{o.padStart(2, "0")}</option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value}
        min={field.min}
        max={field.max}
        onChange={(e) => onChange(e.target.value)}
        className={`${base} w-24`}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.default || ""}
      className={`${base} flex-1`}
    />
  );
}

export default function SettingsPage() {
  const { data: schema, isLoading: schemaLoading } = useSWR("settings_schema", settingsApi.schema, { shouldRetryOnError: false });
  const { data: settings, isLoading: valuesLoading } = useSWR("app_settings", settingsApi.list, { shouldRetryOnError: false });

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!settings) return;
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    setValues((prev) => {
      const merged: Record<string, string> = { ...map };
      for (const k of Object.keys(prev)) merged[k] = prev[k];
      return merged;
    });
  }, [settings]);

  // Default all groups open when schema loads
  useEffect(() => {
    if (!schema) return;
    const plugins = [...new Set(schema.map((f) => f.plugin))];
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const p of plugins) if (!(p in next)) next[p] = true;
      return next;
    });
  }, [schema]);

  function getValue(field: SchemaField) {
    return values[field.key] ?? field.default;
  }

  function toggleGroup(plugin: string) {
    setOpenGroups((p) => ({ ...p, [plugin]: !p[plugin] }));
  }

  async function saveField(field: SchemaField) {
    setSaving((p) => ({ ...p, [field.key]: true }));
    await settingsApi.update(field.key, getValue(field));
    setSaving((p) => ({ ...p, [field.key]: false }));
    setSaved((p) => ({ ...p, [field.key]: true }));
    setTimeout(() => setSaved((p) => ({ ...p, [field.key]: false })), 2000);
  }

  async function runAction(action: string, fieldKey: string) {
    setActionLoading((p) => ({ ...p, [fieldKey]: true }));
    setActionMsg((p) => ({ ...p, [fieldKey]: "" }));
    try {
      if (action === "reload_bot") {
        await settingsApi.reloadBot();
        setActionMsg((p) => ({ ...p, [fieldKey]: "✅ Bot 已重新連線" }));
      }
    } catch {
      setActionMsg((p) => ({ ...p, [fieldKey]: "❌ 操作失敗，請確認設定是否正確" }));
    }
    setActionLoading((p) => ({ ...p, [fieldKey]: false }));
  }

  if (schemaLoading || valuesLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
        <span className="text-sm">載入中...</span>
      </div>
    );
  }

  const groups: { plugin: string; description: string; fields: SchemaField[] }[] = [];
  for (const field of schema ?? []) {
    const g = groups.find((g) => g.plugin === field.plugin);
    if (g) g.fields.push(field);
    else groups.push({ plugin: field.plugin, description: field.plugin_description, fields: [field] });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">系統設定</h1>
      </div>

      {groups.length === 0 && (
        <div className="text-sm text-slate-400 py-8 text-center">沒有可設定的項目</div>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const isOpen = openGroups[group.plugin] ?? true;
          return (
            <div key={group.plugin} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Accordion header */}
              <button
                onClick={() => toggleGroup(group.plugin)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-semibold text-slate-800">{group.description}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-0" : "-rotate-90"}`}
                />
              </button>

              {/* Accordion body */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <div className="flex flex-col gap-5 pt-4">
                    {group.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-slate-600 mb-2">{field.label}</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <FieldInput
                            field={field}
                            value={getValue(field)}
                            onChange={(v) => setValues((p) => ({ ...p, [field.key]: v }))}
                          />
                          <button
                            onClick={() => saveField(field)}
                            disabled={saving[field.key]}
                            className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
                          >
                            {saved[field.key] ? <Check size={15} /> : <Save size={15} />}
                            {saved[field.key] ? "已儲存" : saving[field.key] ? "儲存中..." : "儲存"}
                          </button>
                          {field.action && (
                            <button
                              onClick={() => runAction(field.action!, field.key)}
                              disabled={actionLoading[field.key]}
                              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-sm font-medium rounded-lg transition-colors shrink-0"
                            >
                              <RefreshCw size={14} className={actionLoading[field.key] ? "animate-spin" : ""} />
                              {actionLoading[field.key] ? "執行中..." : "重新連線 Bot"}
                            </button>
                          )}
                        </div>
                        {field.description && (
                          <p className="text-xs text-slate-400 mt-1.5">{field.description}</p>
                        )}
                        {actionMsg[field.key] && (
                          <p className="text-sm text-slate-600 mt-1.5">{actionMsg[field.key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
