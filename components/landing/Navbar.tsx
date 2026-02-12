"use client"

import { useState, useEffect } from "react"
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

  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[var(--grey-200)] shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-full.png"
              alt="HMO Hunter"
              width={220}
              height={56}
              className="h-12 sm:h-14 w-auto mix-blend-multiply"
            />
          </Link>

          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-xl border border-[var(--grey-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--grey-700)] hover:bg-[var(--grey-50)] transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={scrollToForm}
              className="rounded-xl bg-[var(--teal-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--teal)] transition-colors"
            >
              Get Early Access
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-3 text-[var(--grey-600)]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t border-[var(--grey-200)] px-4 py-4 space-y-3">
          <Link
            href="/auth/login"
            className="block w-full rounded-xl border border-[var(--grey-200)] px-4 py-2.5 text-center text-sm font-medium text-[var(--grey-700)]"
            onClick={() => setMenuOpen(false)}
          >
            Sign In
          </Link>
          <button
            onClick={scrollToForm}
            className="block w-full rounded-xl bg-[var(--teal-dark)] px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            Get Early Access
          </button>
        </div>
      )}
    </nav>
  )
}
