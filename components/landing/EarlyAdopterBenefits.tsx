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

export function EarlyAdopterBenefits() {
  return (
    <section className="bg-[var(--grey-50)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[var(--grey-900)] sm:text-3xl"
        >
          Early adopters don't just test, they lead.
        </motion.h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-[var(--grey-200)] bg-white p-6 text-center shadow-sm"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--teal-pale)]">
                <b.icon className="h-6 w-6 text-[var(--teal-dark)]" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[var(--grey-900)]">{b.title}</h3>
              <p className="mt-2 text-sm text-[var(--grey-600)]">{b.description}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
