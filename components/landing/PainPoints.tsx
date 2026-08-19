"use client"

import { motion } from "framer-motion"

const pains = [
  {
    title: "Multiple platforms",
    description:
      "Rightmove, Zoopla, council registers, planning portals — none of them talk to each other.",
  },
  {
    title: "Outdated listings",
    description:
      "Hours wasted on properties already gone, non-compliant, or outside Article 4.",
  },
  {
    title: "Manual checks",
    description:
      "Cross-referencing licensing, compliance, and planning data by hand. Every. Single. Time.",
  },
  {
    title: "Opportunities lost",
    description:
      "By the time you've verified a property, someone else has already taken it.",
  },
]

/**
 * The one dark band on the page. It sets the problem, so it should feel like a
 * held breath between the hero and the answer — and the tonal switch gives the
 * page a spine that an unbroken run of white sections never has.
 */
export function PainPoints() {
  return (
    <section className="lp-grain relative overflow-hidden bg-[var(--grey-900)] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(70% 55% at 15% 0%, rgba(20,153,142,0.24), transparent 60%), radial-gradient(50% 50% at 90% 100%, rgba(60,184,160,0.14), transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="lp-eyebrow text-[var(--teal-light)]"
        >
          The problem
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="lp-display mt-4 max-w-2xl font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold text-white sm:text-[2.75rem]"
        >
          Still sourcing HMOs the hard way?
        </motion.h2>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-white/[0.08] sm:grid-cols-2">
          {pains.map((pain, i) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="group bg-[var(--grey-900)] p-7 transition-colors duration-300 hover:bg-white/[0.03] sm:p-9"
            >
              <span className="lp-eyebrow text-white/30 transition-colors group-hover:text-[var(--teal-light)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-white">
                {pain.title}
              </h3>
              <p className="mt-2.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-white/55">
                {pain.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
