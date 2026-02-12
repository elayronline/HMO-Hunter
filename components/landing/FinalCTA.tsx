"use client"

import { motion } from "framer-motion"
import { REMAINING, TOTAL_SPOTS } from "@/lib/constants"

export function FinalCTA() {
  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative overflow-hidden bg-[var(--teal-dark)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      {/* Dot pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(white 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-white sm:text-3xl"
        >
          Ready to source smarter?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-[var(--teal-light)]"
        >
          Join the first wave of housing professionals using HMO Hunter.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <button
            onClick={scrollToForm}
            className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-[var(--teal-dark)] hover:bg-[var(--grey-50)] transition-colors"
          >
            Secure My Spot
          </button>
          <p className="mt-4 text-sm font-medium text-[var(--teal-light)] font-[family-name:var(--font-dm-mono)]">
            {REMAINING} of {TOTAL_SPOTS} beta places remaining
          </p>
        </motion.div>
      </div>
    </section>
  )
}
