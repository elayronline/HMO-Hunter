"use client"

import { motion } from "framer-motion"

const steps = [
  {
    step: "01",
    title: "Sign up",
    description: "Name, email, password and the kind of work you do. About a minute.",
  },
  {
    step: "02",
    title: "Confirm your email",
    description: "Click the link we send you. That confirms the account — there is no queue to wait in.",
  },
  {
    step: "03",
    title: "Start searching",
    description: "Search, filter and vet straight away. The full platform, from the first login.",
  },
]

export function HowItWorks() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="lp-eyebrow text-[var(--grey-400)]">Getting started</p>
          <h2 className="lp-display mt-4 font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold text-[var(--grey-900)] sm:text-[2.5rem]">
            What happens next?
          </h2>
        </motion.div>

        <ol className="relative mt-16 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {/* Connector, drawn behind the numerals and stopping short of both ends */}
          <div
            aria-hidden
            className="absolute top-6 left-[16.67%] right-[16.67%] hidden h-px sm:block"
            style={{
              background:
                "linear-gradient(90deg, var(--grey-200), var(--teal-light), var(--grey-200))",
            }}
          />

          {steps.map((s, i) => (
            <motion.li
              key={s.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative text-center"
            >
              <div className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--grey-200)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-8px_rgba(15,23,42,0.18)]">
                <span className="lp-eyebrow text-[var(--teal-dark)]">{s.step}</span>
              </div>
              <h3 className="mt-6 text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--grey-900)]">
                {s.title}
              </h3>
              <p className="mx-auto mt-2.5 max-w-[34ch] text-[0.9375rem] leading-relaxed text-[var(--grey-600)]">
                {s.description}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
