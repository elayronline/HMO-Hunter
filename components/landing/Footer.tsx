"use client"

import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-[var(--grey-200)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <Image
              src="/logo-full.png"
              alt="HMO Hunter"
              width={200}
              height={52}
              className="h-10 w-auto mix-blend-multiply"
            />
            <span className="max-w-[34ch] text-center text-sm leading-relaxed text-[var(--grey-500)] sm:text-left">
              Source and vet viable HMOs. In one place.
            </span>
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="text-sm text-[var(--grey-500)] transition-colors hover:text-[var(--teal-dark)]"
              >
                Privacy
              </Link>
              <a
                href="mailto:hello@hmohunter.co.uk"
                className="text-sm text-[var(--grey-500)] transition-colors hover:text-[var(--teal-dark)]"
              >
                Contact
              </a>
              <Link
                href="/auth/login"
                className="text-sm text-[var(--grey-500)] transition-colors hover:text-[var(--teal-dark)]"
              >
                Sign in
              </Link>
            </div>
            <span className="lp-eyebrow text-[var(--grey-400)]">
              &copy; {new Date().getFullYear()} HMO Hunter Ltd
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
