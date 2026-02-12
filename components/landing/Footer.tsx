"use client"

import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-[var(--grey-200)] bg-[var(--grey-50)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-full.png"
              alt="HMO Hunter"
              width={200}
              height={52}
              className="h-11 sm:h-12 w-auto mix-blend-multiply"
            />
            <span className="hidden text-sm text-[var(--grey-400)] sm:inline">
              Find viable HMOs. Spot untapped opportunities. Faster.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--grey-500)]">
            <span>&copy; {new Date().getFullYear()} HMO Hunter Ltd</span>
            <span className="text-[var(--grey-300)]">|</span>
            <Link href="/privacy" className="hover:text-[var(--teal-dark)] hover:underline">
              Privacy Policy
            </Link>
            <span className="text-[var(--grey-300)]">|</span>
            <a href="mailto:hello@hmohunter.co.uk" className="hover:text-[var(--teal-dark)] hover:underline">
              hello@hmohunter.co.uk
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
