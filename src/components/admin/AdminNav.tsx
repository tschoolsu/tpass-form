"use client";
// 後台導覽。桌機（≥md）= 左側 sidebar；手機 = header 下方水平捲動 tab bar。
// 兩者共用同一份 ITEMS 與 active 判斷（usePathname），避免導覽在手機消失。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Radio, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; superAdminOnly?: boolean };

// 成員名單管理已移至中央（auth 的 AUTH_GROUPS）；本服務後台不再有成員頁。
const ITEMS: Item[] = [
  { href: "/admin", label: "我的問卷", icon: LayoutDashboard },
  { href: "/admin/webhooks", label: "通知目標", icon: Radio },
];

function isActive(pathname: string | null, href: string) {
  return href === "/admin" ? pathname === "/admin" : (pathname ?? "").startsWith(href);
}

function itemsFor(superAdmin: boolean) {
  return ITEMS.filter((i) => !i.superAdminOnly || superAdmin);
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: Item;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 border-foreground px-3 py-2 font-bold text-sm shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

export function AdminSidebar({ superAdmin }: { superAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex w-44 shrink-0 flex-col gap-2">
      {itemsFor(superAdmin).map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  );
}

export function AdminTabBar({ superAdmin }: { superAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-16 z-40 border-b-2 border-foreground/20 bg-background/90 backdrop-blur-md md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {itemsFor(superAdmin).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}
