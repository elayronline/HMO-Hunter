import { describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { PotentialHMODetailPanel } from "@/components/potential-hmo-detail-panel"
import type { Property } from "@/lib/types/database"

/**
 * Every compliance column is null on all 2,840 properties this panel renders
 * for, and the ticks were written `?? false`, `?? false`, `?? true` — so each
 * one showed a verdict decided by which default happened to be typed.
 */
const base = {
  id: "1",
  address: "1 Test Street",
  bedrooms: 5,
  is_potential_hmo: true,
  hmo_classification: "ready_to_go",
  meets_space_standards: null,
  bathroom_ratio_compliant: null,
  kitchen_size_compliant: null,
  requires_mandatory_licensing: null,
  potential_occupants: null,
  estimated_yield_percentage: null,
} as unknown as Property

describe("PotentialHMODetailPanel — nothing is asserted without a value", () => {
  it("does not pass or fail a property on compliance it never measured", () => {
    render(<PotentialHMODetailPanel property={base} defaultOpen  canSeeOwnerData />)
    expect(screen.getByText(/Not assessed/i)).toBeInTheDocument()
    expect(screen.queryByText("Space Standards")).not.toBeInTheDocument()
  })

  it("does not call a property unlicensed because the column is empty", () => {
    render(<PotentialHMODetailPanel property={base} defaultOpen  canSeeOwnerData />)
    expect(screen.getByText("Licensing requirement not established")).toBeInTheDocument()
    expect(screen.queryByText("Unlicensed HMO")).not.toBeInTheDocument()
  })

  it("never prints the string 'N/A%'", () => {
    const { container } = render(<PotentialHMODetailPanel property={base} defaultOpen  canSeeOwnerData />)
    expect(container.textContent).not.toContain("N/A%")
    expect(screen.getAllByText(/not known/i).length).toBeGreaterThan(0)
  })

  it("does not headline a verdict from the removed scoring system", () => {
    const { container } = render(<PotentialHMODetailPanel property={base} defaultOpen  canSeeOwnerData />)
    expect(container.textContent).not.toContain("Ready to Go")
    expect(container.textContent).not.toContain("Value-Add Opportunity")
  })

  it("reports a room count as rooms, not as occupants", () => {
    const { container } = render(<PotentialHMODetailPanel property={base} defaultOpen  canSeeOwnerData />)
    expect(container.textContent).toContain("5 rooms")
    expect(container.textContent).not.toContain("5 occupants")
  })

  it("still shows a real measurement when one is held", () => {
    const measured = { ...base, meets_space_standards: true, bathroom_ratio_compliant: false } as Property
    render(<PotentialHMODetailPanel property={measured} defaultOpen  canSeeOwnerData />)
    expect(screen.getByText("Space Standards")).toBeInTheDocument()
    expect(screen.getByText("Bathroom Ratio")).toBeInTheDocument()
  })
})
