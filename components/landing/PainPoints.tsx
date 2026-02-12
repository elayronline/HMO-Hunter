"use client"

import { motion } from "framer-motion"
import { LayoutGrid, Clock, ClipboardCheck, AlertTriangle } from "lucide-react"

const pains = [
  {
    icon: LayoutGrid,
    title: "Multiple Platforms",
    description:
      "Rightmove, Zoopla, council registers, planning portals, none of them talk to each other.",
  },
  {
    icon: Clock,
    title: "Outdated Listings",
    description:
      "Hours wasted on properties already gone, non-compliant, or outside Article 4.",
  },
  {
    icon: ClipboardCheck,
    title: "Manual Checks",
    description:
      "Cross-referencing licensing, compliance, and planning data by hand. Every. Single. Time.",
  },
  {
    icon: AlertTriangle,
    title: "Opportunities Lost",
    description:
      "By the time you've verified a property, someone else has already taken it.",
  },
]

export function PainPoints() {
  return (
    <section className="bg-[var(--grey-50)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[var(--grey-900)] sm:text-3xl"
        >
          Still sourcing HMOs the hard way?
        </motion.h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {pains.map((pain, i) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-[var(--grey-200)] bg-white p-6 shadow-sm"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--teal-pale)]">
                <pain.icon className="h-5 w-5 text-[var(--teal-dark)]" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[var(--grey-900)]">{pain.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--grey-600)]">{pain.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
