"use client"

import { motion } from "framer-motion"
import { Rocket, Eye, MessageSquare } from "lucide-react"

const benefits = [
  {
    icon: Rocket,
    title: "Source From Day One",
    description:
      "Access the live platform immediately. Not a waitlist, a working tool.",
  },
  {
    icon: Eye,
    title: "First Look at Features",
    description:
      "See and use new features before they go public. Stay ahead of every other sourcer.",
  },
  {
    icon: MessageSquare,
    title: "Shape What Comes Next",
    description:
      "Your feedback directly influences the roadmap. Tell us what to build.",
  },
]

/**
 * Three columns under their own rules rather than three more bordered cards.
 * The page has already used a ruled grid for the features; repeating the
 * treatment here is what makes a landing page read as generated.
 */
export function EarlyAdopterBenefits() {
  return (
    <section className="relative overflow-hidden bg-[var(--teal-ghost)] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--teal-light)] to-transparent opacity-60"
      />
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="lp-eyebrow text-[var(--teal-dark)]">Early access</p>
          <h2 className="lp-display mx-auto mt-4 max-w-2xl font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold text-[var(--grey-900)] sm:text-[2.5rem]">
            Early adopters don&rsquo;t just test, they lead.
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.09 }}
              className="group"
            >
              <div className="h-px w-full bg-[var(--teal-light)]/50 transition-colors duration-300 group-hover:bg-[var(--teal)]" />
              <b.icon
                className="mt-7 h-5 w-5 text-[var(--teal-dark)]"
                strokeWidth={1.75}
              />
              <h3 className="mt-5 text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--grey-900)]">
                {b.title}
              </h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--grey-600)]">
                {b.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
