"use client";

import {
  BarChart3,
  Banknote,
  Building2,
  SquareChevronLeft,
  SquareChevronRight,
  Gauge,
  GraduationCap,
  Settings2,
  TrendingUp,
  UsersRound,
  School,
  HeartHandshake,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { href: "/executive-summary", label: "Executive Summary", icon: TrendingUp },
  { label: "Revenue Overview", icon: Gauge, children: [
    { href: "/revenue", label: "Branch Performance", icon: Building2 },
    { href: "/products", label: "Product Performance", icon: BarChart3 },
    { href: "/agents", label: "Agent Productivity", icon: UsersRound },
  ] },
  { label: "Students Overview", icon: GraduationCap, children: [
    { href: "/students", label: "Student Growth", icon: TrendingUp },
    { href: "/students/loyal", label: "Loyal Students", icon: HeartHandshake },
  ] },
  { label: "School Partner", icon: School, children: [
    { href: "/schools", label: "By Revenue", icon: Banknote },
    { href: "/schools/by-students", label: "By BAC Students", icon: GraduationCap },
  ] },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({
  children,
  userName,
  email,
}: {
  children: ReactNode;
  userName?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "Revenue Overview": true, "Students Overview": true, "School Partner": true,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-all lg:flex lg:flex-col ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-4">
          <Link href="/revenue" className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-700 text-sm font-bold text-white">
              JT
            </span>
            {!collapsed ? (
              <span className="truncate text-sm font-semibold text-slate-950">
                Jawa Timur Revenue
              </span>
            ) : null}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            if (item.children) {
              const isOpen = expanded[item.label] ?? false;
              return <div key={item.label}>
                <button type="button" onClick={() => setExpanded((state) => ({ ...state, [item.label]: !isOpen }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />{!collapsed ? <><span className="flex-1 text-left">{item.label}</span><ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} /></> : null}
                </button>
                {!collapsed && isOpen ? <div className="ml-4 space-y-1 border-l border-slate-200 pl-3">{item.children.map((child) => { const ChildIcon = child.icon; const active = pathname === child.href; return <Link key={child.href} href={child.href} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"}`}><ChildIcon className="h-4 w-4" />{child.label}</Link>; })}</div> : null}
              </div>;
            }
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className={`flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${collapsed ? "justify-center" : "justify-end"}`}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <SquareChevronRight className="h-5 w-5" /> : <SquareChevronLeft className="h-5 w-5" />}
          </button>
        </div>
      </aside>

      <div className={`transition-all ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-700 text-xs font-bold text-white">
              JT
            </span>
            <span className="text-sm font-semibold text-slate-950">Revenue Dashboard</span>
          </div>
          <div className="hidden text-sm text-slate-500 lg:block">Jawa Timur · Revenue Operations</div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm font-semibold text-slate-700 sm:block">
              {userName || email || "Akun aktif"}
            </span>
            <ThemeToggle />
            <AccountMenu userName={userName} email={email} />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
