"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  MapPin,
  Filter,
  FileText,
  Bookmark,
  Crown,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  MousePointer2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"

interface OnboardingWalkthroughProps {
  isOpen: boolean
  onComplete: () => void
  onShowPropertyDetails?: () => void
  onHidePropertyDetails?: () => void
}

type HighlightPosition = "center" | "top-left" | "top-center" | "top-right" | "left" | "right" | "bottom-left" | "bottom-center" | "center-left" | "center-right"
type ArrowDirection = "up" | "down" | "left" | "right" | "none"

interface Step {
  icon: typeof Sparkles
  title: string
  description: string
  color: string
  bgColor: string
  highlight: HighlightPosition
  arrow: ArrowDirection
  targetHint: string
}

const steps: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description: "Your smart platform for finding HMO investment opportunities. Let's take a quick tour to get you started.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
  {
    icon: Filter,
    title: "Search & Filters",
    description: "Use the left sidebar to search locations, set price ranges, and filter by property type. Your filters are saved automatically.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    highlight: "center-left",
    arrow: "left",
    targetHint: "The filter panel is on the left side",
  },
  {
    icon: MapPin,
    title: "Property Map",
    description: "The map shows all properties. Teal pins = Licensed HMOs, Green pins = Opportunities, Red pins = Article 4 restricted areas.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Click any pin to view property details",
  },
  {
    icon: FileText,
    title: "Quick Filter Tabs",
    description: "Use these tabs above the map to quickly filter: All, Licensed, Expired, Opportunities, or Restricted properties.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    highlight: "bottom-center",
    arrow: "up",
    targetHint: "Tabs are at the top-center of the map",
  },
  {
    icon: Bookmark,
    title: "Property Details",
    description: "Click any property pin to open the details sidebar on the right. View pricing, yields, compliance info, and save properties.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    highlight: "center-left",
    arrow: "right",
    targetHint: "Details panel is now open on the right",
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description: "Start exploring! Click any pin on the map to begin. Your credit balance is shown in the top bar.",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
]

const ArrowIcon = ({ direction }: { direction: ArrowDirection }) => {
  switch (direction) {
    case "up": return <ArrowUp className="h-6 w-6 animate-bounce" />
    case "down": return <ArrowDown className="h-6 w-6 animate-bounce" />
    case "left": return <ArrowLeft className="h-6 w-6 animate-pulse" />
    case "right": return <ArrowRight className="h-6 w-6 animate-pulse" />
    default: return null
  }
}

const getPositionClasses = (position: HighlightPosition): string => {
  switch (position) {
    case "center":
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    case "top-left":
      return "top-24 left-8"
    case "top-center":
      return "top-24 left-1/2 -translate-x-1/2"
    case "top-right":
      return "top-24 right-8"
    case "left":
      return "top-1/2 left-8 -translate-y-1/2"
    case "right":
      return "top-1/2 right-8 -translate-y-1/2"
    case "center-left":
      return "top-1/2 left-[320px] -translate-y-1/2" // Next to left sidebar (280px + gap)
    case "center-right":
      return "top-1/2 right-[420px] -translate-y-1/2" // Next to right sidebar (400px + gap)
    case "bottom-left":
      return "bottom-24 left-8"
    case "bottom-center":
      return "bottom-24 left-1/2 -translate-x-1/2"
    default:
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
  }
}

const getArrowPositionClasses = (position: HighlightPosition, direction: ArrowDirection): string => {
  if (direction === "none") return "hidden"

  switch (position) {
    case "right":
      return "absolute top-1/2 -right-12 -translate-y-1/2 text-white"
    case "left":
      return "absolute top-1/2 -left-12 -translate-y-1/2 text-white"
    case "center-left":
      return "absolute top-1/2 -left-12 -translate-y-1/2 text-white"
    case "center-right":
      return "absolute top-1/2 -right-12 -translate-y-1/2 text-white"
    case "top-center":
      return "absolute -top-12 left-1/2 -translate-x-1/2 text-white"
    case "top-right":
      return "absolute -top-12 right-8 text-white"
    case "bottom-center":
      return "absolute -bottom-12 left-1/2 -translate-x-1/2 text-white"
    default:
      return "hidden"
  }
}

// Step index for property details demo
const PROPERTY_DETAILS_STEP = 4 // Step 5 (0-indexed)

export function OnboardingWalkthrough({ isOpen, onComplete, onShowPropertyDetails, onHidePropertyDetails }: OnboardingWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isClosing, setIsClosing] = useState(false)

  // Show/hide property details based on current step
  useEffect(() => {
    if (!isOpen) return

    if (currentStep === PROPERTY_DETAILS_STEP) {
      onShowPropertyDetails?.()
    } else {
      onHidePropertyDetails?.()
    }
  }, [currentStep, isOpen, onShowPropertyDetails, onHidePropertyDetails])

  // Clean up when walkthrough closes
  useEffect(() => {
    if (!isOpen || isClosing) {
      onHidePropertyDetails?.()
    }
  }, [isOpen, isClosing, onHidePropertyDetails])

  const handleComplete = async () => {
    setIsClosing(true)
    onHidePropertyDetails?.()

    // Mark onboarding as completed in user metadata
    const supabase = createClient()
    await supabase.auth.updateUser({
      data: { onboarding_completed: true }
    })

    onComplete()
  }

  const handleSkip = async () => {
    await handleComplete()
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isClosing) return
      if (e.key === "ArrowRight" || e.key === "Enter") nextStep()
      if (e.key === "ArrowLeft") prevStep()
      if (e.key === "Escape") handleSkip()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isClosing, currentStep])

  if (!isOpen || isClosing) return null

  const step = steps[currentStep]
  const Icon = step.icon
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dark overlay - only blur on first step, lighter overlay after so dashboard is visible */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          isFirstStep
            ? "bg-black/70 backdrop-blur-sm"
            : "bg-black/20"
        }`}
        onClick={handleSkip}
      />

      {/* Floating tooltip card */}
      <div className={`fixed ${getPositionClasses(step.highlight)} z-[101] w-[90vw] max-w-md`}>
        {/* Arrow pointing to target */}
        <div className={getArrowPositionClasses(step.highlight, step.arrow)}>
          <ArrowIcon direction={step.arrow} />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 z-10 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="p-6 pt-8">
            {/* Icon and title row */}
            <div className="flex items-center gap-4 mb-4">
              <div className={`${step.bgColor} p-3 rounded-xl shrink-0`}>
                <Icon className={`h-6 w-6 ${step.color}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {step.title}
                </h2>
                {step.targetHint && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MousePointer2 className="h-3 w-3" />
                    {step.targetHint}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              {step.description}
            </p>

            {/* Progress bar */}
            <div className="flex gap-1.5 mb-5">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    index <= currentStep ? "bg-teal-500" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={prevStep}
                  size="sm"
                  className="flex-1"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              <Button
                onClick={nextStep}
                size="sm"
                className={`flex-1 bg-teal-600 hover:bg-teal-700 ${isFirstStep ? 'w-full' : ''}`}
              >
                {isLastStep ? (
                  <>
                    Get Started
                    <Sparkles className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>

            {/* Step counter and keyboard hint */}
            <div className="flex justify-between items-center mt-4">
              <p className="text-xs text-slate-400">
                Step {currentStep + 1} of {steps.length}
              </p>
              <p className="text-xs text-slate-400">
                Press → to continue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Highlight pulse rings for non-center positions */}
      {step.highlight !== "center" && (
        <div className={`fixed ${getHighlightRingPosition(step.highlight)} z-[99] pointer-events-none`}>
          <div className="relative">
            <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-teal-400 animate-ping opacity-20" />
            <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-teal-400 opacity-40" />
          </div>
        </div>
      )}
    </div>
  )
}

function getHighlightRingPosition(position: HighlightPosition): string {
  switch (position) {
    case "top-center":
      return "top-16 left-1/2 -translate-x-1/2"
    case "top-right":
      return "top-16 right-16"
    case "right":
      return "top-1/2 right-16 -translate-y-1/2"
    case "left":
      return "top-1/2 left-72 -translate-y-1/2"
    case "center-left":
      return "top-1/2 left-36 -translate-y-1/2" // Points to left sidebar
    case "center-right":
      return "top-1/2 right-48 -translate-y-1/2" // Points to right sidebar area
    case "bottom-center":
      return "top-24 left-1/2 -translate-x-1/2" // Points to tabs at top of map
    default:
      return "hidden"
  }
}
