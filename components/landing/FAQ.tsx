"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Minus } from "lucide-react"

const faqs = [
  {
    q: "What is HMO Hunter?",
    a: "HMO Hunter is the UK's first property sourcing platform built exclusively for HMO professionals. It brings together compliance data, licensing status, Article 4 zone mapping, and yield projections into a single search tool, replacing the need to cross-reference multiple platforms manually.",
  },
  {
    q: "Who is HMO Hunter for?",
    a: "It's built for anyone sourcing or managing HMOs: local authority housing teams, housing associations, private investors and landlords, council housing teams, and property agents or sourcers.",
  },
  {
    q: 'What does "beta access" mean?',
    a: "Beta access means you get to use the live platform before public launch. You'll have full access to search, filter, and assess HMOs. In return, we ask for your honest feedback to help us improve.",
  },
  {
    q: "Is it free?",
    a: "During beta, yes, completely free. We'll announce pricing before public launch. Beta testers will receive preferential early adopter rates.",
  },
  {
    q: "How is this different from Rightmove, Zoopla, or council registers?",
    a: "Those platforms weren't built for HMO sourcing. HMO Hunter combines property listings with compliance data, Article 4 mapping, licensing status, and yield projections, so you can assess viability in seconds instead of hours.",
  },
  {
    q: "What data does HMO Hunter use?",
    a: "We aggregate publicly available data from property listings, council registers, planning portals, and Land Registry records. All data is verified and updated regularly.",
  },
  {
    q: "When will I get access after signing up?",
    a: "Beta access is rolling out in waves. You'll receive your access link by email as soon as your wave is live. The earlier you sign up, the sooner you get in.",
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[var(--grey-900)] sm:text-3xl"
        >
          Frequently Asked Questions
        </motion.h2>

        <div className="mt-10 divide-y divide-[var(--grey-200)] rounded-2xl border border-[var(--grey-200)] bg-white">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div key={i}>
                <button
                  id={`faq-trigger-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-4 sm:px-6 py-5 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)]"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                >
                  <span className="pr-4 text-sm font-semibold text-[var(--grey-800)]">
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <Minus className="h-4 w-4 flex-shrink-0 text-[var(--grey-400)]" />
                  ) : (
                    <Plus className="h-4 w-4 flex-shrink-0 text-[var(--grey-400)]" />
                  )}
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${i}`}
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? "max-h-96 pb-5" : "max-h-0"
                  }`}
                >
                  <p className="px-4 sm:px-6 text-sm leading-relaxed text-[var(--grey-600)]">
                    {faq.a}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
