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
      <Navbar />
      <Hero />
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
