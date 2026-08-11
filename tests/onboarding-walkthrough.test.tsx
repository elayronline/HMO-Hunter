import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough"

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  })),
}))


// ============================================================================
// Basic Rendering Per Role
// ============================================================================
describe("Basic Rendering Per Role", () => {
  ;[null].forEach(() => {
    it("should render the welcome step", () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
        />
      )
      expect(screen.getByText("Welcome to HMO Hunter")).toBeInTheDocument()
      expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument()
    })
  })

  it("renders the walkthrough with no role concept", () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
      />
    )
    expect(screen.getByText("Welcome to HMO Hunter")).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument()
  })

  it("renders the same walkthrough every time", () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
      />
    )
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument()
  })

  it("should not render when isOpen is false", () => {
    render(
      <OnboardingWalkthrough
        isOpen={false}
        onComplete={vi.fn()}
      />
    )
    expect(screen.queryByText("Welcome to HMO Hunter")).not.toBeInTheDocument()
  })
})

// ============================================================================
// Rapid Navigation Stress
// ============================================================================
describe("Rapid Navigation", () => {
  it("should handle 50 rapid next clicks without crashing", async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={onComplete}
      />
    )

    for (let i = 0; i < 50; i++) {
      const btn = screen.queryByText("Next") || screen.queryByText("Get Started")
      if (btn) {
        await act(async () => {
          fireEvent.click(btn)
        })
      }
    }
    // Should have completed after navigating through all 7 steps
    expect(onComplete).toHaveBeenCalled()
  })

  it("should not show Back button on first step", () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
      />
    )
    expect(screen.queryByText("Back")).not.toBeInTheDocument()
  })

  it("should handle rapid next/prev alternation without crashing", async () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
      />
    )

    // Go to step 2 first
    await act(async () => {
      fireEvent.click(screen.getByText("Next"))
    })

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        fireEvent.click(screen.getByText("Next"))
      })
      await act(async () => {
        fireEvent.click(screen.getByText("Back"))
      })
    }
    // Should still be rendered, not crashed
    expect(screen.getByText(/Step/)).toBeInTheDocument()
  })

  it("navigates through all steps to completion", async () => {
    {
      const onComplete = vi.fn()
      const { unmount } = render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={onComplete}
        />
      )

      // 6 Next clicks + 1 Get Started click = 7 total for 7 steps
      for (let i = 0; i < 7; i++) {
        const btn = screen.queryByText("Next") || screen.queryByText("Get Started")
        if (btn) {
          await act(async () => {
            fireEvent.click(btn)
          })
        }
      }
      expect(onComplete).toHaveBeenCalledTimes(1)
      unmount()
    }
  })
})

// ============================================================================
// Keyboard Navigation Per Role
// ============================================================================
describe("Keyboard Navigation", () => {
  ;[null].forEach(() => {
    it("should navigate forward with ArrowRight", async () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
        />
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowRight" })
      })
      expect(screen.getByText(/Step 2 of/)).toBeInTheDocument()
    })

    it("should navigate forward with Enter for", async () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
        />
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter" })
      })
      expect(screen.getByText(/Step 2 of/)).toBeInTheDocument()
    })

    it("should navigate backward with ArrowLeft for", async () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
        />
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowRight" })
      })
      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowLeft" })
      })
      expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
    })

    it("should skip with Escape for", async () => {
      const onComplete = vi.fn()
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={onComplete}
        />
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: "Escape" })
      })
      expect(onComplete).toHaveBeenCalled()
    })
  })

  it("should handle 100 rapid keyboard events without crashing", async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={onComplete}
      />
    )

    for (let i = 0; i < 100; i++) {
      const key = i % 3 === 0 ? "ArrowRight" : i % 3 === 1 ? "ArrowLeft" : "Enter"
      await act(async () => {
        fireEvent.keyDown(window, { key })
      })
    }
    // Should have eventually completed or still be rendered
    expect(true).toBe(true) // No crash = pass
  })
})

// ============================================================================
// Role Change Mid-Walkthrough
// ============================================================================

// ============================================================================
// Property Details Trigger Per Role
// ============================================================================
describe("Property Details Trigger", () => {
  ;[null].forEach(() => {
    it("should call onShowPropertyDetails at the Property Details step for", async () => {
      const onShow = vi.fn()
      const onHide = vi.fn()
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          onShowPropertyDetails={onShow}
          onHidePropertyDetails={onHide}
        />
      )

      // Property Details is step 6 (index 5) for all roles — navigate there
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.keyDown(window, { key: "ArrowRight" })
        })
      }

      expect(onShow).toHaveBeenCalled()
    })

    it("should call onHidePropertyDetails when leaving Property Details step for", async () => {
      const onShow = vi.fn()
      const onHide = vi.fn()
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          onShowPropertyDetails={onShow}
          onHidePropertyDetails={onHide}
        />
      )

      // Navigate to Property Details step
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.keyDown(window, { key: "ArrowRight" })
        })
      }

      // Navigate past it
      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowRight" })
      })

      // onHide should have been called when leaving the step
      expect(onHide).toHaveBeenCalled()
    })
  })
})

// ============================================================================
// Skip / Complete Behaviour
// ============================================================================
describe("Skip / Complete Behaviour", () => {
  it("should call onComplete when clicking skip (X button)", async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={onComplete}
      />
    )

    const skipButton = screen.getByLabelText("Skip tour")
    await act(async () => {
      fireEvent.click(skipButton)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("should call onComplete when clicking Get Started on the last step", async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={onComplete}
      />
    )

    // Navigate to last step
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        const btn = screen.queryByText("Next")
        if (btn) fireEvent.click(btn)
      })
    }

    // Click Get Started
    const getStarted = screen.queryByText("Get Started")
    if (getStarted) {
      await act(async () => {
        fireEvent.click(getStarted)
      })
    }
    expect(onComplete).toHaveBeenCalled()
  })
})
