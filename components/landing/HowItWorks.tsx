"use client"

import { motion } from "framer-motion"
import { UserPlus, Mail, Rocket } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    step: "1",
    title: "Sign up",
    description: "Create your account. That's all you need to secure your spot.",
  },
  {
    icon: Mail,
    step: "2",
    title: "Get your beta access link",
    description: "When beta access is live, you will receive your link to the platform.",
  },
  {
    icon: Rocket,
    step: "3",
    title: "Start searching",
    description: "Sign in and search, filter, and find viable HMOs immediately.",
  },
]

export function HowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[var(--grey-900)] sm:text-3xl"
        >
          What happens next?
        </motion.h2>

        <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
          {/* Connecting line */}
          <div className="absolute top-8 left-[16.67%] right-[16.67%] hidden h-0.5 bg-[var(--grey-200)] sm:block" />

          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--teal)] bg-white text-xl font-bold text-[var(--teal-dark)]">
                {s.step}
              </div>
              <h3 className="mt-4 text-lg font-bold text-[var(--grey-900)]">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--grey-600)]">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
