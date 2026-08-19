"use client"

import { motion } from "framer-motion"
import { ShieldCheck, Landmark, BadgeCheck, FileSearch, TrendingUp, LayoutGrid } from "lucide-react"
import { formatCount, type LandingStats } from "@/lib/landing-stats"

/**
 * Every figure quoted below comes from `stats`, counted at request time. Where
 * a card would need a number it does not have, it states the behaviour instead
 * — the claim has to survive the database being unreachable.
 */
function buildFeatures(stats: LandingStats | null) {
  return [
    {
      icon: ShieldCheck,
      title: "Article 4, in three states",
      description: stats
        ? `In force, confirmed outside, or not established — never a boolean. ${formatCount(
            stats.inForce
          )} properties sit inside a live direction and ${formatCount(
            stats.noneFound
          )} are positively placed outside one. The rest say so plainly instead of guessing.`
        : "In force, confirmed outside, or not established — never a boolean. Where nothing settles the question, we say so instead of guessing.",
    },
    {
      icon: Landmark,
      title: "The council's own words",
      description: stats
        ? `The national planning feed is voluntary and many councils file nothing. Where it is silent we read the council's own direction and quote it — ${formatCount(
            stats.councilVerified
          )} properties are settled that way.`
        : "The national planning feed is voluntary and many councils file nothing. Where it is silent we read the council's own direction and quote it.",
    },
    {
      icon: BadgeCheck,
      title: "Licence state, kept honest",
      description:
        "“Recorded as expired” when the register says so. “Licence term ended” when it is our copy of the date that ran out. Those are different findings, and we never merge them.",
    },
    {
      icon: FileSearch,
      title: "Check any address",
      description:
        "Use class, licence status and expiry, and the permitted development route to an HMO where one exists. Every report ends with the questions that still need a phone call, and exports as a PDF you can send on.",
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
        "Map, address check, saved properties, pipeline and an attention list, in one place instead of six browser tabs.",
    },
  ]
}

export function Features({ stats }: { stats: LandingStats | null }) {
  const features = buildFeatures(stats)

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[var(--grey-900)] sm:text-3xl">
            One place to source them. One place to vet them.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--grey-600)]">
            HMO Hunter brings together the planning, licensing and viability checks you
            would otherwise do by hand, and tells you plainly where the evidence runs out.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group rounded-2xl border border-[var(--grey-200)] bg-white p-6 shadow-sm transition-all hover:border-[var(--teal-mid)] hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--teal-pale)]">
                <feature.icon className="h-5 w-5 text-[var(--teal-dark)]" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[var(--grey-900)]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--grey-600)]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
