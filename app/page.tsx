"use client"

import dynamic from "next/dynamic"
import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { AudiencePills } from "@/components/landing/AudiencePills"

const PainPoints = dynamic(() => import("@/components/landing/PainPoints").then(m => m.PainPoints))
const Features = dynamic(() => import("@/components/landing/Features").then(m => m.Features))
const EarlyAdopterBenefits = dynamic(() => import("@/components/landing/EarlyAdopterBenefits").then(m => m.EarlyAdopterBenefits))
const HowItWorks = dynamic(() => import("@/components/landing/HowItWorks").then(m => m.HowItWorks))
const SignupForm = dynamic(() => import("@/components/landing/SignupForm").then(m => m.SignupForm))
const FAQ = dynamic(() => import("@/components/landing/FAQ").then(m => m.FAQ))
const FinalCTA = dynamic(() => import("@/components/landing/FinalCTA").then(m => m.FinalCTA))
const Footer = dynamic(() => import("@/components/landing/Footer").then(m => m.Footer))

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
