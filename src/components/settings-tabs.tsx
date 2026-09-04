"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type SettingsTab = "overview" | "uploads" | "targets" | "access";

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "uploads", label: "Data Upload" },
  { id: "targets", label: "Target Management" },
  { id: "access", label: "User & Access" },
];

export function SettingsTabs({
  overview,
  uploads,
  targets,
  access,
}: {
  overview: ReactNode;
  uploads: ReactNode;
  targets: ReactNode;
  access: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
  const panels = { overview, uploads, targets, access };

  return (
    <div className="grid gap-5">
      <nav className="flex w-full gap-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-1" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {tabs.map((tab) => (
        <section key={tab.id} hidden={activeTab !== tab.id} role="tabpanel" aria-label={tab.label}>
          {panels[tab.id]}
        </section>
      ))}
    </div>
  );
}
