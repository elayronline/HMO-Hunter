"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Rocket, Eye, MessageSquare } from "lucide-react"
import { TOTAL_SPOTS, REMAINING, FILLED, FILL_PERCENT } from "@/lib/constants"

const benefits = [
  {
    icon: Rocket,
    title: "Source From Day One",
    description:
      "Access the live platform immediately. Not a waitlist,a working tool.",
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

function AnimatedCounter({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    if (!ref.current || hasAnimated) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true)
          let start = 0
          const step = Math.ceil(target / 40)
          const interval = setInterval(() => {
            start += step
            if (start >= target) {
              setCount(target)
              clearInterval(interval)
            } else {
              setCount(start)
            }
          }, 30)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, hasAnimated])

  return (
    <span ref={ref} className="font-[family-name:var(--font-dm-mono)]">
      {count}
    </span>
  )
}

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
          Early adopters don't just test,they lead.
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

        {/* Scarcity counter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mt-12 max-w-md text-center"
        >
          <p className="text-3xl font-extrabold text-[var(--teal-dark)]">
            <AnimatedCounter target={REMAINING} /> of {TOTAL_SPOTS}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--grey-500)]">
            beta places remaining
          </p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[var(--grey-200)]">
            <div
              className="h-full rounded-full bg-[var(--teal)] transition-all duration-1000"
              style={{ width: `${FILL_PERCENT}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--grey-400)]">
            {FILLED} spots claimed
          </p>
        </motion.div>
      </div>
    </section>
  )
}
