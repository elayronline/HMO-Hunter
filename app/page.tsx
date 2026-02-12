"use client"

import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { AudiencePills } from "@/components/landing/AudiencePills"
import { PainPoints } from "@/components/landing/PainPoints"
import { Features } from "@/components/landing/Features"
import { EarlyAdopterBenefits } from "@/components/landing/EarlyAdopterBenefits"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { SignupForm } from "@/components/landing/SignupForm"
import { FAQ } from "@/components/landing/FAQ"
import { FinalCTA } from "@/components/landing/FinalCTA"
import { Footer } from "@/components/landing/Footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white font-[family-name:var(--font-plus-jakarta)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--teal-dark)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Navbar />
      <Hero />
      <div id="main-content" />
      <AudiencePills />
      <PainPoints />
      <Features />
      <EarlyAdopterBenefits />
      <HowItWorks />
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8 bg-[var(--grey-50)]">
        <div className="mx-auto max-w-3xl">
          <SignupForm />
        </div>
      </section>
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}
