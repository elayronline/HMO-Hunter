"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X } from "lucide-react"

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) setMenuOpen(false)
    },
    [menuOpen]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [handleEscape])

  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  // The bar is opaque once scrolled, not frosted. logo-full is a WebP with no
  // alpha, so it depends on mix-blend-multiply to knock out its white ground —
  // and any translucency or backdrop-filter here isolates the blend, leaving the
  // logo as a white block whenever a dark section passes underneath.
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-[var(--grey-200)] bg-white"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div
          className={`flex items-center justify-between transition-all duration-500 ${
            scrolled ? "h-16" : "h-20"
          }`}
        >
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-full.png"
              alt="HMO Hunter"
              width={220}
              height={56}
              priority
              className="h-11 w-auto mix-blend-multiply sm:h-12"
            />
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <Link
              href="/auth/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--grey-600)] transition-colors hover:text-[var(--grey-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
            <button
              onClick={scrollToForm}
              className="rounded-lg bg-[var(--grey-900)] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2)] transition-all hover:bg-[var(--teal-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-2"
            >
              Get early access
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="-mr-2 p-3 text-[var(--grey-600)] focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] sm:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="space-y-2.5 border-t border-[var(--grey-200)] bg-white/95 px-4 py-5 backdrop-blur-xl sm:hidden"
        >
          <Link
            href="/auth/login"
            className="block w-full rounded-xl border border-[var(--grey-200)] px-4 py-3 text-center text-sm font-medium text-[var(--grey-700)]"
            onClick={() => setMenuOpen(false)}
          >
            Sign in
          </Link>
          <button
            onClick={scrollToForm}
            className="block w-full rounded-xl bg-[var(--grey-900)] px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Get early access
          </button>
        </div>
      )}
    </nav>
  )
}
