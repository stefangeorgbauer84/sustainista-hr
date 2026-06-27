"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Calendar, ShieldAlert, Download } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Übersicht", icon: Home },
  { href: "/admin/employees", label: "Personal", icon: Users },
  { href: "/admin/leave", label: "Urlaub", icon: Calendar },
  { href: "/admin/employees/status", label: "Status", icon: ShieldAlert },
  { href: "/admin/reports/payroll", label: "Lohn", icon: Download },
];

export default function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-gray-200 bg-white md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map(item => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition ${
              active ? "text-[#4F772D]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
