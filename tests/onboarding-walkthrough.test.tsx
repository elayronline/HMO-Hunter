import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough"
import type { UserType } from "@/components/role-selection-modal"

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  })),
}))

const ALL_ROLES: UserType[] = ["investor", "council_ta", "operator", "agent"]

// ============================================================================
// Basic Rendering Per Role
// ============================================================================
describe("Basic Rendering Per Role", () => {
  ALL_ROLES.forEach((role) => {
    it(`should render the welcome step for ${role}`, () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
        />
      )
      expect(screen.getByText("Welcome to HMO Hunter")).toBeInTheDocument()
      expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument()
    })
  })

  it("should render fallback steps when userRole is null", () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole={null}
      />
    )
    expect(screen.getByText("Welcome to HMO Hunter")).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument()
  })

  it("should render fallback steps when userRole is undefined", () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
      />
    )
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument()
  })

  it("should not render when isOpen is false", () => {
    render(
      <OnboardingWalkthrough
        isOpen={false}
        onComplete={vi.fn()}
        userRole="investor"
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
        userRole="investor"
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
        userRole="agent"
      />
    )
    expect(screen.queryByText("Back")).not.toBeInTheDocument()
  })

  it("should handle rapid next/prev alternation without crashing", async () => {
    render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole="operator"
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

  it("should navigate through all steps to completion for each role", async () => {
    for (const role of ALL_ROLES) {
      const onComplete = vi.fn()
      const { unmount } = render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={onComplete}
          userRole={role}
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
describe("Keyboard Navigation Per Role", () => {
  ALL_ROLES.forEach((role) => {
    it(`should navigate forward with ArrowRight for ${role}`, async () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
        />
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowRight" })
      })
      expect(screen.getByText(/Step 2 of/)).toBeInTheDocument()
    })

    it(`should navigate forward with Enter for ${role}`, async () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
        />
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter" })
      })
      expect(screen.getByText(/Step 2 of/)).toBeInTheDocument()
    })

    it(`should navigate backward with ArrowLeft for ${role}`, async () => {
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
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

    it(`should skip with Escape for ${role}`, async () => {
      const onComplete = vi.fn()
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={onComplete}
          userRole={role}
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
        userRole="investor"
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
describe("Role Change Mid-Walkthrough", () => {
  it("should reset to step 1 when userRole prop changes", async () => {
    const { rerender } = render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole="investor"
      />
    )

    // Navigate to step 3
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" })
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" })
    })
    expect(screen.getByText(/Step 3 of/)).toBeInTheDocument()

    // Change role
    rerender(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole="council_ta"
      />
    )

    // Should be back at step 1
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
  })

  it("should show correct step count after switching to fallback", async () => {
    const { rerender } = render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole="investor"
      />
    )
    expect(screen.getByText(/of 7/)).toBeInTheDocument()

    rerender(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole={null}
      />
    )
    expect(screen.getByText(/of 6/)).toBeInTheDocument()
  })

  it("should handle rapid role switching without crashing", async () => {
    const { rerender } = render(
      <OnboardingWalkthrough
        isOpen={true}
        onComplete={vi.fn()}
        userRole="investor"
      />
    )

    for (let i = 0; i < 50; i++) {
      const role = ALL_ROLES[i % ALL_ROLES.length]
      rerender(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
        />
      )
    }
    // Should still be rendered
    expect(screen.getByText("Welcome to HMO Hunter")).toBeInTheDocument()
  })
})

// ============================================================================
// Property Details Trigger Per Role
// ============================================================================
describe("Property Details Trigger", () => {
  ALL_ROLES.forEach((role) => {
    it(`should call onShowPropertyDetails at the Property Details step for ${role}`, async () => {
      const onShow = vi.fn()
      const onHide = vi.fn()
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
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

    it(`should call onHidePropertyDetails when leaving Property Details step for ${role}`, async () => {
      const onShow = vi.fn()
      const onHide = vi.fn()
      render(
        <OnboardingWalkthrough
          isOpen={true}
          onComplete={vi.fn()}
          userRole={role}
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
        userRole="investor"
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
        userRole="investor"
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
