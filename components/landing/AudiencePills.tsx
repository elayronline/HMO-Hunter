"use client"

import { motion } from "framer-motion"

const audiences = [
  "Local Authorities",
  "Housing Associations",
  "Private Investors",
  "Council Housing Teams",
]

export function AudiencePills() {
  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-sm font-medium text-[var(--grey-600)]"
        >
          Built for professionals sourcing across
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {audiences.map((name) => (
            <span
              key={name}
              className="rounded-full bg-[var(--teal-pale)] px-4 py-1.5 text-sm font-medium text-[var(--teal-dark)]"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
