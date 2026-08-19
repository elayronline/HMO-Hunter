"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Minus } from "lucide-react"

const faqs = [
    {
      q: "What is HMO Hunter?",
      a: "A property sourcing platform built exclusively for HMO professionals. It covers both existing HMOs and properties with change of use potential, bringing the planning position, licensing status and viability figures into one search — so you can source and vet without cross-referencing council registers, planning portals and listing sites by hand.",
    },
    {
      q: "Who is HMO Hunter for?",
      a: "It's built for anyone sourcing or managing HMOs: local authority housing teams, housing associations, private investors and landlords, council housing teams, and property agents or sourcers.",
    },
    {
      q: 'What does "beta access" mean?',
      a: "The platform is live and you get all of it. Beta means we are still building on it, features land often, and we ask for your honest feedback in return. There is no waiting list and no queue.",
    },
    {
      q: "Is it free?",
      a: "Free during beta, with no card to enter. Usage is metered rather than unlimited: 150 credits a day, your first 20 property views free, and caps of 100 saved properties, 10 saved searches and 10 price alerts. We'll announce pricing before public launch, and beta testers will receive preferential early adopter rates.",
    },
    {
      q: "How is this different from Rightmove, Zoopla, or council registers?",
      a: "Those weren't built for HMO sourcing. The difference that matters most is how we handle uncertainty: a property's Article 4 position is recorded as in force, confirmed outside, or not established, and never collapsed into a yes or no. Where nothing settles it we say so — silence in a national dataset is not an all clear.",
    },
    {
      q: "What data does HMO Hunter use?",
      a: "Publicly available data: property listings, council registers and planning portals, Land Registry records, and Article 4 directions read from councils' own websites. Where a council publishes nothing usable, we record that rather than infer an answer. The address check report states the basis for every planning position, including the council's own wording where we hold it.",
    },
    {
      q: "When will I get access after signing up?",
      a: "Straight away. Confirm your email, sign in, and the platform is open — there are no waves to wait for.",
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
