"use client";
import { useRef, useState, type ChangeEvent } from "react";
import useSWR from "swr";
import { Trash2, Plus, Wallet, Pencil, X, ChevronLeft, ChevronRight, Download, Upload, Check, Star } from "lucide-react";
import { expenseApi, expenseAccountApi, type ExpenseRecord, type ExpenseAccount } from "@/lib/api";

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

function CategoryBars({ items }: { items: { category: string; amount: number; count: number }[] }) {
  const top = items.slice(0, 8);
  if (top.length === 0) return null;
  const maxAmt = Math.max(...top.map((c) => c.amount), 1);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="text-sm font-medium text-slate-700 mb-3">分類佔比（本月）</div>
      <div className="flex flex-col gap-2">
        {top.map((c) => (
          <div key={c.category} className="flex items-center gap-3">
            <div className="text-xs text-slate-500 w-24 shrink-0 truncate" title={c.category}>{c.category}</div>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${Math.max(0, (c.amount / maxAmt) * 100)}%` }} />
            </div>
            <div className="text-xs font-medium text-slate-700 w-20 text-right shrink-0">${c.amount.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyTrend({ items }: { items: { month: string; total: number }[] }) {
  const rows = [...items].reverse();
  if (rows.every((r) => r.total === 0)) return null;
  const maxAmt = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="text-sm font-medium text-slate-700 mb-3">每月支出（近 6 個月）</div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.month} className="flex items-center gap-3">
            <div className="text-xs text-slate-500 w-16 shrink-0">{r.month}</div>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${Math.max(0, (r.total / maxAmt) * 100)}%` }} />
            </div>
            <div className="text-xs font-medium text-slate-700 w-20 text-right shrink-0">${r.total.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Account tabs ─────────────────────────────────────────────

function AccountTabs({
  accounts,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onSetDefault,
}: {
  accounts: ExpenseAccount[];
  selectedId: number | "all";
  onSelect: (id: number | "all") => void;
  onAdd: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function startEdit(acc: ExpenseAccount) {
    setEditingId(acc.id);
    setEditName(acc.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(acc: ExpenseAccount) {
    if (!editName.trim()) return;
    await onRename(acc.id, editName.trim());
    cancelEdit();
  }

  async function saveNew() {
    if (!newName.trim()) return;
    await onAdd(newName.trim());
    setNewName("");
    setAdding(false);
  }

  const tabClass = (active: boolean) =>
    `group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
     ${active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => onSelect("all")} className={tabClass(selectedId === "all")}>
          全部
        </button>
        {accounts.map((acc) =>
          editingId === acc.id ? (
            <div key={acc.id} className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(acc); if (e.key === "Escape") cancelEdit(); }}
                className="text-sm outline-none bg-transparent w-24 text-slate-800"
              />
              <button onClick={() => saveEdit(acc)} className="text-emerald-600 hover:text-emerald-700" title="儲存">
                <Check size={14} />
              </button>
              <button
                onClick={() => onSetDefault(acc.id)}
                className={`${acc.is_default ? "text-emerald-500" : "text-slate-300 hover:text-emerald-400"}`}
                title={acc.is_default ? "預設帳戶" : "設為預設"}
              >
                <Star size={14} />
              </button>
              <button
                onClick={() => { onDelete(acc.id); cancelEdit(); }}
                disabled={acc.record_count > 0}
                className="text-slate-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={acc.record_count > 0 ? "有記錄無法刪除" : "刪除"}
              >
                <Trash2 size={14} />
              </button>
              <button onClick={cancelEdit} className="text-slate-300 hover:text-slate-500" title="取消">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button key={acc.id} onClick={() => onSelect(acc.id)} className={tabClass(selectedId === acc.id)}>
              {acc.is_default && <Star size={11} className="text-emerald-400 fill-emerald-400" />}
              {acc.name}
              <span
                onClick={(e) => { e.stopPropagation(); startEdit(acc); }}
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
              placeholder="帳戶名稱"
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
            <Plus size={13} /> 新增帳戶
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function ExpensePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");

  const { data: accounts, mutate: mutateAccounts } = useSWR<ExpenseAccount[]>("expense_accounts", expenseAccountApi.list);
  const { data: categories } = useSWR<string[]>("expense_categories", expenseApi.categories);

  const accountParam = selectedAccountId === "all" ? undefined : selectedAccountId;
  const swrSuffix = `${year}-${month}_${selectedAccountId}`;
  const { data: allRecords, isLoading, mutate: mutateRecords } = useSWR(
    `expense_records_${swrSuffix}`,
    () => expenseApi.records(year, month, accountParam),
  );
  const { data: summary, mutate: mutateSummary } = useSWR(
    `expense_summary_${swrSuffix}`,
    () => expenseApi.summary(year, month, accountParam),
  );

  const [page, setPage] = useState(1);
  const records = (allRecords ?? []).slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalCount = allRecords?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [recordDate, setRecordDate] = useState(today());
  const [formAccountId, setFormAccountId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function changeMonth(delta: number) {
    const idx = year * 12 + (month - 1) + delta;
    setYear(Math.floor(idx / 12));
    setMonth((idx % 12) + 1);
    setPage(1);
  }

  function selectAccount(id: number | "all") {
    setSelectedAccountId(id);
    setPage(1);
  }

  const effectiveFormAccountId =
    formAccountId !== "" ? formAccountId
    : selectedAccountId !== "all" ? selectedAccountId
    : accounts?.find((a) => a.is_default)?.id ?? accounts?.[0]?.id ?? "";

  function startEdit(r: ExpenseRecord) {
    setEditingId(r.id);
    setAmount(String(r.amount));
    setCategory(r.category ?? "");
    setNote(r.note ?? "");
    setRecordDate(r.date);
    setFormAccountId(r.account_id ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setAmount(""); setCategory(""); setNote(""); setRecordDate(today()); setFormAccountId("");
  }

  async function refresh() {
    await Promise.all([mutateRecords(), mutateSummary(), mutateAccounts()]);
  }

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    const data = {
      amount: Number(amount),
      category,
      note,
      date: recordDate,
      account_id: effectiveFormAccountId === "" ? undefined : Number(effectiveFormAccountId),
    };
    if (editingId !== null) {
      await expenseApi.update(editingId, data);
      setEditingId(null);
    } else {
      await expenseApi.create(data);
    }
    setAmount(""); setCategory(""); setNote(""); setRecordDate(today()); setFormAccountId("");
    await refresh();
    setSaving(false);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    await expenseApi.remove(id);
    await refresh();
    setDeleting(null);
  }

  async function handleAddAccount(name: string) {
    const acc = await expenseAccountApi.create(name);
    await mutateAccounts();
    setSelectedAccountId(acc.id);
  }

  async function handleRenameAccount(id: number, name: string) {
    await expenseAccountApi.update(id, name);
    await mutateAccounts();
  }

  async function handleDeleteAccount(id: number) {
    await expenseAccountApi.remove(id);
    if (selectedAccountId === id) setSelectedAccountId("all");
    await mutateAccounts();
  }

  async function handleSetDefault(id: number) {
    await expenseAccountApi.setDefault(id);
    await mutateAccounts();
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const result = await expenseApi.importExcel(file);
      setImportMsg(
        `匯入完成：新增 ${result.imported} 筆，略過 ${result.skipped} 筆（已存在）` +
        (result.accounts_created ? `，新帳戶 ${result.accounts_created} 個` : "") +
        (result.categories_created ? `，新分類 ${result.categories_created} 個` : "")
      );
      await refresh();
    } catch {
      setImportMsg("匯入失敗，請確認檔案格式。");
    }
    setImporting(false);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const daysElapsed = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate();
  const dailyAvg = summary && summary.total > 0 ? Math.round(summary.total / daysElapsed) : null;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">記帳</h1>
          <div className="flex gap-2">
            <button onClick={() => fileInput.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40">
              <Upload size={14} />
              {importing ? "匯入中..." : "匯入 Excel"}
            </button>
            <input ref={fileInput} type="file" accept=".xlsx" onChange={handleImport} className="hidden" />
            <a href={expenseApi.exportUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Download size={14} />
              匯出 Excel
            </a>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Telegram 指令：
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">記 70 吃午餐</code>
          <span className="mx-1">·</span>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">本月</code>
          <span className="mx-1">·</span>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">記帳</code>
        </p>
        {importMsg && <p className="mt-2 text-sm text-emerald-600">{importMsg}</p>}
      </div>

      {accounts && (
        <AccountTabs
          accounts={accounts}
          selectedId={selectedAccountId}
          onSelect={selectAccount}
          onAdd={handleAddAccount}
          onRename={handleRenameAccount}
          onDelete={handleDeleteAccount}
          onSetDefault={handleSetDefault}
        />
      )}

      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => changeMonth(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-lg font-semibold text-slate-800 w-32 text-center">{year} 年 {month} 月</span>
        <button onClick={() => changeMonth(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="本月支出" value={`$${summary.total.toLocaleString()}`} highlight />
          <StatCard label="筆數" value={String(summary.count)} />
          {dailyAvg !== null && <StatCard label="日均" value={`$${dailyAvg.toLocaleString()}`} />}
          <StatCard label="上月支出" value={`$${summary.prev_total.toLocaleString()}`} />
        </div>
      )}

      {summary && <CategoryBars items={summary.by_category} />}
      {summary && <MonthlyTrend items={summary.monthly} />}

      <div className={`border rounded-xl p-4 mb-6 ${editingId ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-slate-700">{editingId ? "編輯記帳" : "新增記帳"}</div>
          {editingId && (
            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input value={recordDate} onChange={(e) => setRecordDate(e.target.value)} type="date"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金額 (元)" type="number"
            className="flex-1 min-w-[90px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="分類" list="expense-categories"
            className="flex-1 min-w-[110px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition" />
          <datalist id="expense-categories">
            {(categories ?? []).map((c) => <option key={c} value={c} />)}
          </datalist>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註"
            className="flex-1 min-w-[110px] border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition" />
          <select value={effectiveFormAccountId} onChange={(e) => setFormAccountId(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white">
            {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving || !amount}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
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
          const isEditing = editingId === r.id;
          const isRefund = r.amount < 0;
          return (
            <div key={r.id} className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3.5 ${isEditing ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isRefund ? "bg-teal-100 text-teal-600" : "bg-emerald-100 text-emerald-600"}`}>
                <Wallet size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold ${isRefund ? "text-teal-600" : "text-slate-800"}`}>
                    ${r.amount.toLocaleString()}
                  </span>
                  {r.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">{r.category}</span>
                  )}
                  {selectedAccountId === "all" && r.account_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{r.account_name}</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {r.date}
                  {r.note && <span> · {r.note}</span>}
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

      {!isLoading && totalCount === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Wallet size={36} className="mx-auto mb-3 opacity-40" />
          <div className="text-sm">這個月還沒有記帳記錄，先新增一筆吧！</div>
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
