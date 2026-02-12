"use client"

import { motion } from "framer-motion"
import { VideoPlayer } from "./VideoPlayer"

export function Hero() {
  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-36 sm:pb-24 lg:px-8">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, var(--teal-pale), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(var(--teal) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left column,copy */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-[family-name:var(--font-plus-jakarta)] text-4xl font-extrabold leading-tight text-[var(--grey-900)] sm:text-5xl"
            >
              Find Viable HMOs.{" "}
              <span className="text-[var(--teal)]">Spot Untapped Opportunities.</span>{" "}
              Faster.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 text-lg leading-relaxed text-[var(--grey-600)]"
            >
              The UK's first sourcing platform built exclusively for HMO professionals.
              Search compliance data, licensing status, Article 4 zones, and yield
              projections,all in one place.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <button
                onClick={scrollToForm}
                className="rounded-xl bg-[var(--teal-dark)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--teal)] transition-colors"
              >
                Get Early Access
              </button>
              <button
                onClick={() =>
                  document.getElementById("video-section")?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-xl border border-[var(--grey-200)] bg-white px-6 py-3 text-sm font-medium text-[var(--grey-700)] hover:bg-[var(--grey-50)] transition-colors"
              >
                Watch how it works
              </button>
            </motion.div>
          </div>

          {/* Right column,video */}
          <motion.div
            id="video-section"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <VideoPlayer />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
