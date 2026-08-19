"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"

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
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="lg:sticky lg:top-28 lg:self-start"
        >
          <p className="lp-eyebrow text-[var(--grey-400)]">Questions</p>
          <h2 className="lp-display mt-4 font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold text-[var(--grey-900)] sm:text-[2.5rem]">
            Frequently asked
          </h2>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--grey-500)]">
            Anything else, email{" "}
            <a
              href="mailto:hello@hmohunter.co.uk"
              className="text-[var(--teal-dark)] underline decoration-[var(--teal-light)] underline-offset-4 hover:decoration-[var(--teal-dark)]"
            >
              hello@hmohunter.co.uk
            </a>
            .
          </p>
        </motion.div>

        <div className="border-t border-[var(--grey-200)]">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div key={i} className="border-b border-[var(--grey-200)]">
                <button
                  id={`faq-trigger-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="group flex w-full items-start justify-between gap-6 py-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)]"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                >
                  <span
                    className={`text-[1.0625rem] font-medium leading-snug tracking-[-0.01em] transition-colors ${
                      isOpen
                        ? "text-[var(--grey-900)]"
                        : "text-[var(--grey-700)] group-hover:text-[var(--grey-900)]"
                    }`}
                  >
                    {faq.q}
                  </span>
                  <Plus
                    aria-hidden
                    className={`mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--grey-400)] transition-transform duration-300 ${
                      isOpen ? "rotate-45 text-[var(--teal-dark)]" : "group-hover:text-[var(--grey-600)]"
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${i}`}
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] pb-7 opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[62ch] pr-10 text-[0.9375rem] leading-[1.75] text-[var(--grey-600)]">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
