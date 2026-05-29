const BASE = "";

// ── Plugins ─────────────────────────────────────────────────

export interface Plugin {
  name: string;
  display: string;
  description: string;
  version: string;
  enabled: boolean;
  show_nav: boolean;
  nav_path: string;
}

export const pluginApi = {
  list: () => apiFetch<Plugin[]>("/api/plugins"),
  setEnabled: (name: string, enabled: boolean) =>
    apiFetch(`/api/plugins/settings/plugin.${name}.enabled`, {
      method: "PATCH",
      body: JSON.stringify({ value: enabled ? "true" : "false" }),
    }),
  reorder: (names: string[]) =>
    apiFetch("/api/plugins/settings/plugins.order", {
      method: "PATCH",
      body: JSON.stringify({ value: names.join(",") }),
    }),
  setShowNav: (name: string, showNav: boolean) =>
    apiFetch(`/api/plugins/settings/plugin.${name}.show_nav`, {
      method: "PATCH",
      body: JSON.stringify({ value: showNav ? "true" : "false" }),
    }),
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Fuel ───────────────────────────────────────────────────

export interface Car {
  id: number;
  name: string;
  is_default: boolean;
  record_count: number;
}

export interface FuelRecord {
  id: number;
  date: string;
  odometer: number;
  liters: number;
  cost: number;
  distance: number | null;
  efficiency: number | null;
  car_id: number | null;
}

export const carApi = {
  list: () => apiFetch<Car[]>("/api/plugins/fuel/cars"),
  create: (name: string) =>
    apiFetch<Car>("/api/plugins/fuel/cars", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  update: (id: number, name: string) =>
    apiFetch<Car>(`/api/plugins/fuel/cars/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  remove: (id: number) =>
    apiFetch(`/api/plugins/fuel/cars/${id}`, { method: "DELETE" }),
  setDefault: (id: number) =>
    apiFetch<Car>(`/api/plugins/fuel/cars/${id}/default`, { method: "POST" }),
};

export const fuelApi = {
  list: (car_id?: number) =>
    apiFetch<FuelRecord[]>(
      `/api/plugins/fuel/records${car_id !== undefined ? `?car_id=${car_id}` : ""}`
    ),
  create: (car_id: number, odometer: number, liters: number, cost: number, date?: string) =>
    apiFetch<FuelRecord>("/api/plugins/fuel/records", {
      method: "POST",
      body: JSON.stringify({ car_id, odometer, liters, cost, date }),
    }),
  update: (id: number, data: { odometer?: number; liters?: number; cost?: number; date?: string }) =>
    apiFetch<FuelRecord>(`/api/plugins/fuel/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    apiFetch(`/api/plugins/fuel/records/${id}`, { method: "DELETE" }),
};

// ── Reminder ───────────────────────────────────────────────

export interface ReminderItem {
  id: number;
  name: string;
  freq_days: number;
  category: string | null;
  last_done: string | null;
  days_since: number | null;
  is_overdue: boolean;
}

// ── Settings ───────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
}

export interface SchemaField {
  plugin: string;
  plugin_description: string;
  key: string;
  label: string;
  type: "text" | "password" | "number" | "select";
  default: string;
  description?: string;
  action?: string;
  min?: number;
  max?: number;
  options?: string[];
}

export const settingsApi = {
  schema: () => apiFetch<SchemaField[]>("/api/plugins/settings/schema"),
  list: () => apiFetch<Setting[]>("/api/plugins/settings"),
  update: (key: string, value: string) =>
    apiFetch<Setting>(`/api/plugins/settings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  reloadBot: () =>
    apiFetch<{ status: string }>("/api/plugins/settings/reload-bot", { method: "POST" }),
};

// ── Cycle ───────────────────────────────────────────────────

export interface CycleRecord {
  id: number;
  start_date: string;
  cycle_length: number | null;
  notes: string | null;
}

export interface CycleForecast {
  has_data: boolean;
  default_cycle: number;
  avg_cycle: number;
  period_length: number;
  last_period?: string;
  period_end?: string;
  current_day?: number;
  next_period?: string;
  next_period_end?: string;
  ovulation?: string;
  fertile_start?: string;
  fertile_end?: string;
  today?: string;
}

export const cycleApi = {
  list: () => apiFetch<CycleRecord[]>("/api/plugins/cycle/records"),
  forecast: () => apiFetch<CycleForecast>("/api/plugins/cycle/forecast"),
  create: (start_date: string, notes?: string, cycle_length?: number) =>
    apiFetch<CycleRecord>("/api/plugins/cycle/records", {
      method: "POST",
      body: JSON.stringify({ start_date, notes, cycle_length }),
    }),
  update: (id: number, data: { notes?: string; cycle_length?: number }) =>
    apiFetch<CycleRecord>(`/api/plugins/cycle/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    apiFetch(`/api/plugins/cycle/records/${id}`, { method: "DELETE" }),
};

// ── Weather ─────────────────────────────────────────────────

export interface DayForecast {
  date: string;
  weather_code: number;
  weather_desc: string;
  weather_icon: string;
  temp_max: number;
  temp_min: number;
  precipitation_prob: number;
}

export interface WeatherData {
  city: string;
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  weather_code: number;
  weather_desc: string;
  weather_icon: string;
  forecast: DayForecast[];
}

export const weatherApi = {
  get: (city?: string) =>
    apiFetch<WeatherData>(
      `/api/plugins/weather/weather${city ? `?city=${encodeURIComponent(city)}` : ""}`
    ),
};

export const reminderApi = {
  list: () => apiFetch<ReminderItem[]>("/api/plugins/reminder/items"),
  create: (name: string, freq_days: number, category?: string) =>
    apiFetch<ReminderItem>("/api/plugins/reminder/items", {
      method: "POST",
      body: JSON.stringify({ name, freq_days, category }),
    }),
  done: (id: number) =>
    apiFetch<ReminderItem>(`/api/plugins/reminder/items/${id}/done`, { method: "POST" }),
  update: (id: number, data: { freq_days?: number; category?: string; last_done?: string }) =>
    apiFetch<ReminderItem>(`/api/plugins/reminder/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    apiFetch(`/api/plugins/reminder/items/${id}`, { method: "DELETE" }),
};
