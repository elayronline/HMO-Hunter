"use client"

import { motion } from "framer-motion"
import { track } from "@vercel/analytics"
import { ArrowRight } from "lucide-react"

export function FinalCTA() {
  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <div className="lp-grain relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[var(--grey-900)] px-6 py-20 text-center sm:px-12 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 60% at 50% 0%, rgba(20,153,142,0.34), transparent 62%), radial-gradient(45% 45% at 15% 100%, rgba(60,184,160,0.16), transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--teal-mid)] to-transparent opacity-70"
        />

        <div className="relative mx-auto max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lp-display font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold text-white sm:text-[3rem]"
          >
            Ready to source smarter?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto mt-5 max-w-[42ch] text-[1.0625rem] leading-relaxed text-white/60"
          >
            Create an account and start searching. It takes about a minute.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="mt-10"
          >
            <button
              onClick={() => {
                track("cta_click", { location: "final" })
                scrollToForm()
              }}
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-[var(--grey-900)] shadow-[0_1px_2px_rgba(0,0,0,0.2),0_12px_32px_-12px_rgba(0,0,0,0.6)] transition-all hover:bg-[var(--teal-pale)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--grey-900)]"
            >
              Create my account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="lp-eyebrow mt-6 text-white/40">
              Free while in beta &middot; no card required
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
