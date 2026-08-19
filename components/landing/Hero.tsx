"use client"

import { track } from "@vercel/analytics"
import { ArrowRight } from "lucide-react"
import { VideoPlayer } from "./VideoPlayer"

/**
 * The entrance is CSS (`.lp-rise` in globals.css), not framer-motion. Motion's
 * `initial` prop is serialised into the server HTML as opacity:0, which leaves
 * the hero blank until hydration — the one part of the page that can least
 * afford it. Below-the-fold sections still use motion, since they genuinely
 * need scroll detection.
 */
export function Hero() {
  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-36 sm:pb-24 lg:px-8">
      {/* Ground: a teal wash top-right, a cool one bottom-left, over a fine grid.
          Three cheap layers that give the flat white some depth. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 right-[-10%] h-[720px] w-[720px] rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, var(--teal-pale), transparent 62%)" }}
        />
        <div
          className="absolute -bottom-56 left-[-15%] h-[560px] w-[560px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #EEF4FB, transparent 65%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(var(--teal) 1px, transparent 1px), linear-gradient(90deg, var(--teal) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse 90% 70% at 65% 30%, black, transparent 68%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 65% 30%, black, transparent 68%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          {/* Copy */}
          <div>
            <div className="lp-rise inline-flex items-center gap-2.5 rounded-full border border-[var(--grey-200)] bg-white/70 py-1.5 pl-2 pr-4 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--teal-mid)] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--teal)]" />
              </span>
              <span className="lp-eyebrow text-[var(--grey-600)]">
                In beta &middot; free while we build
              </span>
            </div>

            <h1
              className="lp-rise lp-display mt-7 font-[family-name:var(--font-plus-jakarta)] text-[2.5rem] font-extrabold text-[var(--grey-900)] sm:text-[3.25rem] lg:text-[3.5rem]"
              style={{ animationDelay: "60ms" }}
            >
              Source <span className="text-[var(--teal)]">and vet</span> viable HMOs.
              In one place.
            </h1>

            <p
              className="lp-rise mt-7 max-w-[46ch] text-[1.0625rem] leading-[1.7] text-[var(--grey-600)]"
              style={{ animationDelay: "120ms" }}
            >
              Find and vet viable HMOs, both existing and change of use potential.
              Get the insight you need to source to your needs.
            </p>

            <div
              className="lp-rise mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              style={{ animationDelay: "180ms" }}
            >
              <button
                onClick={() => {
                  track("cta_click", { location: "hero" })
                  scrollToForm()
                }}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--grey-900)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.24),0_8px_24px_-8px_rgba(15,23,42,0.5)] transition-all hover:bg-[var(--teal-dark)] hover:shadow-[0_1px_2px_rgba(10,107,110,0.3),0_12px_28px_-8px_rgba(10,107,110,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-2"
              >
                Get early access
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() =>
                  document.getElementById("video-section")?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center justify-center rounded-xl border border-[var(--grey-200)] bg-white/80 px-6 py-3.5 text-sm font-medium text-[var(--grey-700)] backdrop-blur-sm transition-colors hover:border-[var(--grey-300)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-2"
              >
                Watch how it works
              </button>
            </div>
          </div>

          {/* Video, framed with enough depth to read as a product shot */}
          <div id="video-section" className="lp-rise relative" style={{ animationDelay: "240ms" }}>
            <div
              aria-hidden
              className="absolute -inset-10 rounded-[2.5rem] opacity-70 blur-3xl"
              style={{
                background:
                  "radial-gradient(55% 55% at 50% 55%, rgba(20,153,142,0.20), transparent 72%)",
              }}
            />
            <div className="relative rounded-2xl bg-gradient-to-b from-[var(--grey-200)] to-[var(--grey-100)] p-px shadow-[0_2px_4px_rgba(15,23,42,0.04),0_24px_56px_-20px_rgba(15,23,42,0.28)]">
              <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-white">
                <VideoPlayer />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
