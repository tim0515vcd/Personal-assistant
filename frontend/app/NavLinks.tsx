"use client";
import useSWR from "swr";
import { Bell, Fuel, Heart, CloudSun, type LucideIcon } from "lucide-react";
import { pluginApi, type Plugin } from "@/lib/api";

const ICONS: Record<string, LucideIcon> = {
  reminder: Bell,
  fuel: Fuel,
  cycle: Heart,
  weather: CloudSun,
};

export function NavLinks() {
  const { data: plugins } = useSWR<Plugin[]>(
    "plugins",
    () => pluginApi.list(),
    { shouldRetryOnError: false }
  );

  return (
    <>
      {plugins
        ?.filter((p) => p.nav_path)
        .map((p) => {
          const Icon = ICONS[p.name] ?? CloudSun;
          return (
            <a
              key={p.name}
              href={p.nav_path}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors no-underline"
            >
              <Icon size={14} />
              {p.display || p.name}
            </a>
          );
        })}
    </>
  );
}
