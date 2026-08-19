"use client"

import { motion } from "framer-motion"
import { ShieldCheck, Landmark, BadgeCheck, FileSearch, TrendingUp, LayoutGrid } from "lucide-react"

/**
 * These cards describe behaviour, never inventory size. Quoting a property or
 * council count would put a number on coverage that is still being connected,
 * and a figure on a public page is read as a commitment.
 */
const features = [
  {
    icon: ShieldCheck,
    title: "Article 4, in three states",
    description:
      "In force, confirmed outside, or not established — never a boolean. Where nothing settles the question we say so, because silence in a national dataset is not an all clear.",
  },
  {
    icon: Landmark,
    title: "The council's own words",
    description:
      "The national planning feed is voluntary and many councils file nothing. Where it is silent we read the council's own direction and quote it, rather than treat the gap as an answer.",
  },
  {
    icon: BadgeCheck,
    title: "Licence state, kept honest",
    description:
      "“Recorded as expired” when the register says so. “Licence term ended” when it is our copy of the date that ran out. Those are different findings, and we never merge them.",
  },
  {
    icon: FileSearch,
    title: "Existing HMOs and conversion candidates",
    description:
      "Check any address for what it is now — use class, licence status and expiry — and for the permitted development route to an HMO where one exists. Every report ends with the questions that still need a phone call, and exports as a PDF you can send on.",
  },
  {
    icon: TrendingUp,
    title: "Yield where there is a price",
    description:
      "Gross yield on purchase listings, from the asking price and room-by-room rent. Left blank where there is no price to divide by, because a zero is not a low yield.",
  },
  {
    icon: LayoutGrid,
    title: "One workspace",
    description:
      "Map, list, address check and your saved properties in one place instead of six browser tabs. The dashboard covers two things: what has landed on the listings you saved, and which Article 4 directions arrive next.",
  },
]

export function Features() {
  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <p className="lp-eyebrow text-[var(--teal)]">What you get</p>
          <h2 className="lp-display mt-4 font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold text-[var(--grey-900)] sm:text-[2.75rem]">
            One place to source them. One place to vet them.
          </h2>
          <p className="mt-5 max-w-[54ch] text-[1.0625rem] leading-relaxed text-[var(--grey-600)]">
            HMO Hunter brings together the planning, licensing and viability checks you
            would otherwise do by hand, and tells you plainly where the evidence runs out.
          </p>
        </motion.div>

        {/* One ruled block rather than six floating cards: the hairlines carry the
            structure, so nothing has to be lifted off the page to look separate. */}
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-[var(--grey-200)] bg-[var(--grey-200)] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
              className="group relative flex flex-col bg-white p-7 transition-colors duration-300 hover:bg-[var(--teal-ghost)] sm:p-8"
            >
              <div className="flex items-center justify-between">
                <feature.icon
                  className="h-5 w-5 text-[var(--teal-dark)] transition-transform duration-300 group-hover:-translate-y-0.5"
                  strokeWidth={1.75}
                />
                <span className="lp-eyebrow text-[var(--grey-300)] transition-colors group-hover:text-[var(--teal-mid)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--grey-900)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--grey-600)]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
