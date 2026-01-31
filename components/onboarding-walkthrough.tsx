"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
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
  Sparkles
} from "lucide-react"

interface OnboardingWalkthroughProps {
  isOpen: boolean
  onComplete: () => void
}

const steps = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description: "Your smart platform for finding HMO investment opportunities. Let's take a quick tour to get you started.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
  },
  {
    icon: MapPin,
    title: "Interactive Property Map",
    description: "Browse properties on our interactive map. Each pin represents a property - click to see details. Colors indicate property status: green for licensed HMOs, blue for opportunities.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    icon: Filter,
    title: "Smart Filters",
    description: "Use the category tabs to filter properties: Licensed HMOs, Potential Opportunities, Restricted Areas, and more. Narrow down to exactly what you're looking for.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    icon: FileText,
    title: "Property Details",
    description: "Click any property to view full details in the sidebar: pricing, bedrooms, yield estimates, HMO licence status, and area insights.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    icon: Bookmark,
    title: "Save Properties",
    description: "Found something interesting? Click the bookmark icon to save properties for later. Access your saved list anytime from the Saved page.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description: "Start exploring properties now. Need help? Click the Help link in the menu anytime. Happy hunting!",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
]

export function OnboardingWalkthrough({ isOpen, onComplete }: OnboardingWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isClosing, setIsClosing] = useState(false)

  const handleComplete = async () => {
    setIsClosing(true)

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

  const step = steps[currentStep]
  const Icon = step.icon
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  return (
    <Dialog open={isOpen && !isClosing} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 z-10 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-8 pt-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`${step.bgColor} p-4 rounded-full`}>
              <Icon className={`h-10 w-10 ${step.color}`} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-slate-900 text-center mb-3">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-slate-600 text-center text-sm leading-relaxed mb-8">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-6 bg-teal-600"
                    : "w-2 bg-slate-200 hover:bg-slate-300"
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={prevStep}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            <Button
              onClick={nextStep}
              className={`flex-1 bg-teal-600 hover:bg-teal-700 ${isFirstStep ? 'w-full' : ''}`}
            >
              {isLastStep ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>

          {/* Step counter */}
          <p className="text-xs text-slate-400 text-center mt-4">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
