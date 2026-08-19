"use client"

import { motion } from "framer-motion"

const audiences = [
  "Local Authorities",
  "Housing Associations",
  "Private Investors",
  "Council Housing Teams",
  "Property Agents & Sourcers",
]

/**
 * Deliberately understated. This row sits directly under the hero, and pastel
 * chips there compete with the headline for attention while saying less — a
 * quiet caption reads as more confident than a coloured badge.
 */
export function AudiencePills() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="lp-rule" />
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="lp-eyebrow mt-8 text-center text-[var(--grey-400)]"
        >
          Built for professionals sourcing across
        </motion.p>
        <motion.ul
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:gap-x-5"
        >
          {audiences.map((name, i) => (
            <li key={name} className="flex items-center gap-3 sm:gap-5">
              <span className="text-sm font-medium text-[var(--grey-600)]">{name}</span>
              {i < audiences.length - 1 && (
                <span aria-hidden className="hidden h-1 w-1 rounded-full bg-[var(--grey-300)] sm:block" />
              )}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
