"use client"

/**
 * The frame every working surface sits in.
 *
 * Until now each page drew its own header, which is why the product read as a
 * set of tools rather than as one platform: nothing told you where you were or
 * what else existed. A persistent rail fixes both, and it earns its width by
 * carrying state — the count beside "Licences" is the number of expired ones,
 * so the rail is a standing status line rather than a menu.
 *
 * The layout is deliberately full-width. A sourcer works across a map, a list
 * and a report, and centring everything in a narrow column on a 27-inch monitor
 * wastes the screen they bought for exactly this.
 */

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Map as MapIcon,
  FileSearch,
  Bookmark,
  KanbanSquare,
  HelpCircle,
  Menu,
  X,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** A live number worth carrying in the rail, where one exists. */
  badge?: number
  /** Badges that mean "something is wrong" read differently to a plain count. */
  badgeTone?: "neutral" | "danger"
}

const PRIMARY: NavItem[] = [
  { href: "/user-dashboard", label: "Attention", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/hmo-check", label: "Address check", icon: FileSearch },
]

const SECONDARY: NavItem[] = [
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
]

const FOOTER: NavItem[] = [{ href: "/help", label: "Help", icon: HelpCircle }]

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] font-medium transition-colors ${
        active
          ? "bg-white text-ink shadow-[var(--elev-1)]"
          : "text-ink-subtle hover:bg-white/60 hover:text-ink"
      }`}
    >
      {/* The active marker is a rule against the rail edge rather than a filled
          block: it locates you without shouting. */}
      {active && (
        <span className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand" aria-hidden />
      )}
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand" : "text-ink-faint group-hover:text-ink-muted"}`} />
      <span className="truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span
          className={`tnum ml-auto rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold ${
            item.badgeTone === "danger"
              ? "bg-danger-soft text-danger"
              : "bg-surface-sunken text-ink-subtle"
          }`}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  )
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label?: string
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <div className="space-y-0.5">
      {label && <p className="eyebrow px-2.5 pb-1.5 pt-4">{label}</p>}
      {items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

export interface AppShellProps {
  children: React.ReactNode
  /** Page title, shown in the top bar. */
  title: string
  /** One line under the title. Facts about the data, never instructions. */
  subtitle?: string
  /** Page-level actions, right-aligned in the top bar. */
  actions?: React.ReactNode
  /** Counts the rail carries, so navigation doubles as a status line. */
  counts?: { expired?: number }
  /** Surfaces that manage their own scrolling, like the map. */
  bleed?: boolean
}

export function AppShell({ children, title, subtitle, actions, counts, bleed }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const primary = PRIMARY.map((item) =>
    item.href === "/user-dashboard" && counts?.expired
      ? { ...item, badge: counts.expired, badgeTone: "danger" as const }
      : item
  )

  const rail = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-1 px-3 pb-4 pt-4">
      {/* logo-symbol.png is the full lockup despite its name, so at rail size it
          reduced to an illegible smudge. brand-mark.png is the shield cropped
          out of it, which stays readable small — and the wordmark is set as live
          text so it matches the rest of the interface. */}
      <Link
        href="/user-dashboard"
        onClick={onNavigate}
        className="mb-3 flex items-center gap-2 px-1.5"
        aria-label="HMO Hunter — dashboard"
      >
        <Image src="/brand-mark.png" alt="" width={28} height={28} priority />
        <span className="text-[0.9375rem] font-bold tracking-tight text-ink">HMO Hunter</span>
      </Link>

      <NavGroup items={primary} pathname={pathname} onNavigate={onNavigate} />
      <NavGroup label="Workspace" items={SECONDARY} pathname={pathname} onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        <NavGroup items={FOOTER} pathname={pathname} onNavigate={onNavigate} />
        {/* Stating the sourcing limits in the furniture, not only in reports.
            Someone should not have to open a report to learn what the product
            does not know. */}
        <p className="rounded-md border border-line bg-surface-inset px-2.5 py-2 text-[0.6875rem] leading-relaxed text-ink-subtle">
          Planning positions are recorded from published sources. An address we
          hold nothing on is unchecked, not clear.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Desktop rail */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface-sunken lg:block"
        style={{ width: "var(--shell-width)" }}
      >
        {rail()}
      </aside>

      {/* Mobile rail */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/25"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 border-r border-line bg-surface-sunken shadow-[var(--elev-3)]"
            style={{ width: "var(--shell-width)" }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded p-1 text-ink-subtle hover:bg-white/60"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {rail(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <div className="lg:pl-[var(--shell-width)]">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded p-1.5 text-ink-muted hover:bg-surface-sunken lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[1.0625rem] font-bold leading-tight tracking-tight text-ink">
                {title}
              </h1>
              {subtitle && <p className="truncate text-[0.8125rem] text-ink-subtle">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </header>

        <main className={bleed ? "" : "px-4 py-6 sm:px-6 lg:px-8"}>{children}</main>
      </div>
    </div>
  )
}

/**
 * The standard action button, so every top bar matches.
 */
export function ShellButton({
  children,
  onClick,
  variant = "secondary",
  href,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary"
  href?: string
}) {
  const className = `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-hover"
      : "border border-line-strong bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink"
  }`
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  )
}
