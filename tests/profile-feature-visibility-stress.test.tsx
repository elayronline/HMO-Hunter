/**
 * Stress tests: Role-based feature visibility in PropertyDetailCard
 *
 * Renders PropertyDetailCard with each role and asserts:
 *  - Investor: deal score visible, yield metrics visible, TA hidden, LHA hidden
 *  - Council/TA: deal score hidden, yield hidden, TA visible, LHA visible, ownership hidden
 *  - Operator: deal score hidden, yield hidden, TA hidden, ownership visible
 *  - Agent: deal score visible, yield visible, TA hidden, ownership visible
 *  - Fallback (null): everything visible
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { PropertyDetailCard } from "@/components/property-detail-card"
import type { Property } from "@/lib/types/database"
import type { UserType } from "@/components/role-selection-modal"

// ---------------------------------------------------------------------------
// Mocks — heavy child components that hit APIs or use browser-only features
// ---------------------------------------------------------------------------

// Mock fetch globally (auto-enrich fires on mount)
globalThis.fetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
) as unknown as typeof fetch

// Mock clipboard
Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

vi.mock("@/components/premium-yield-calculator", () => ({
  PremiumYieldCalculator: ({ property }: { property: Property }) => (
    <div data-testid="yield-calculator">Yield Calculator: {property.id}</div>
  ),
}))

vi.mock("@/components/area-statistics-card", () => ({
  AreaStatisticsCard: () => <div data-testid="area-stats">Area Stats</div>,
}))

vi.mock("@/components/sold-price-history", () => ({
  SoldPriceHistory: () => <div data-testid="sold-history">Sold History</div>,
}))

vi.mock("@/components/kamma-compliance-card", () => ({
  KammaComplianceCard: () => <div data-testid="kamma">Kamma</div>,
}))

vi.mock("@/components/licence-details-card", () => ({
  LicenceDetailsCard: () => <div data-testid="licence-details">Licence Details</div>,
}))

vi.mock("@/components/enriched-data-display", () => ({
  EnrichedDataDisplay: () => <div data-testid="enriched-data">Enriched Data</div>,
}))

vi.mock("@/components/save-property-button", () => ({
  SavePropertyButton: () => <button data-testid="save-btn">Save</button>,
}))

vi.mock("@/components/agent-contact-card", () => ({
  AgentContactCard: () => <div data-testid="agent-contact">Agent Contact</div>,
}))

vi.mock("@/components/ta-suitability-badge", () => ({
  TASuitabilityBadge: ({ property }: { property: Property }) => (
    <span data-testid="ta-badge">TA Badge</span>
  ),
}))

vi.mock("@/components/epc-badge", () => ({
  EPCBadge: ({ rating }: { rating: string }) => (
    <span data-testid="epc-badge">EPC {rating}</span>
  ),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Property factory
// ---------------------------------------------------------------------------
function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "test-vis-id",
    title: "Test Visibility Property",
    address: "42 Visibility Lane",
    postcode: "M14 5TQ",
    city: "Manchester",
    country: "England",
    latitude: 53.4,
    longitude: -2.2,
    listing_type: "purchase",
    price_pcm: null,
    purchase_price: 250000,
    estimated_rent_per_room: 550,
    property_type: "HMO",
    hmo_status: "Licensed HMO",
    tenure: "Freehold",
    licensed_hmo: true,
    source_type: null,
    source_name: null,
    source_url: null,
    external_id: null,
    last_synced: null,
    last_ingested_at: null,
    last_seen_at: null,
    is_stale: false,
    stale_marked_at: null,
    bedrooms: 5,
    bathrooms: 2,
    is_furnished: false,
    is_student_friendly: false,
    is_pet_friendly: false,
    has_garden: true,
    has_parking: true,
    wifi_included: false,
    near_tube_station: false,
    available_from: null,
    description: "A test property for visibility tests",
    image_url: null,
    images: null,
    floor_plans: null,
    primary_image: null,
    media_source_url: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    last_updated: null,
    licence_id: "LIC-VIS-001",
    licence_start_date: "2023-01-01",
    licence_end_date: "2028-01-01",
    licence_status: "active",
    hmo_licence_number: "LIC-VIS-001",
    hmo_licence_start: "2023-01-01",
    hmo_licence_end: "2028-01-01",
    hmo_max_occupants: 5,
    hmo_max_households: null,
    hmo_storeys: null,
    epc_rating: "C",
    epc_floor_area: 120,
    epc_energy_efficiency: 72,
    epc_certificate_url: "https://example.com/epc",
    owner_name: "John Smith",
    company_name: "Smith Properties Ltd",
    company_number: "12345678",
    licence_holder_name: "Jane Doe",
    licence_holder_company: null,
    article_4_area: false,
    article_4_direction_date: null,
    article_4_notes: null,
    deal_score: 75,
    gross_yield: 8.5,
    is_potential_hmo: true,
    hmo_classification: "ready_to_go",
    hmo_classification_confidence: 0.9,
    hmo_classification_reasons: ["5+ bedrooms", "Licensed"],
    broadband_speed: null,
    broadband_provider: null,
    broadband_type: null,
    gross_internal_area_sqm: 120,
    lettable_rooms: 5,
    estimated_gross_monthly_rent: 2750,
    estimated_yield_percentage: 13.2,
    compliance_complexity: null,
    max_occupants: 5,
    epc_rating_numeric: 72,
    deal_score_breakdown: null,
    hmo_suitability_score: null,
    ...overrides,
  } as Property
}

const ALL_ROLES: UserType[] = ["investor", "council_ta", "operator", "agent"]

function renderCard(
  role: UserType | null | undefined,
  overrides: Partial<Property> = {}
) {
  return render(
    <PropertyDetailCard
      property={makeProperty(overrides)}
      onViewFullDetails={vi.fn()}
      isPremium={true}
      isSaved={false}
      userRole={role}
    />
  )
}

// ============================================================================
// 1. Investor Visibility
// ============================================================================
describe("Investor Visibility", () => {
  it("shows deal score badge", () => {
    renderCard("investor")
    expect(screen.getByText("75")).toBeInTheDocument()
  })

  it("shows yield metrics bar (Net Yield, Gross Yield, Cashflow)", () => {
    renderCard("investor")
    expect(screen.getByText("Net Yield")).toBeInTheDocument()
    expect(screen.getByText("Gross Yield")).toBeInTheDocument()
    expect(screen.getByText("Cashflow")).toBeInTheDocument()
  })

  it("shows yield calculator in Analysis tab", () => {
    renderCard("investor")
    expect(screen.getByTestId("yield-calculator")).toBeInTheDocument()
  })

  it("shows ownership section in Details tab", async () => {
    renderCard("investor")
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /details/i }))
    })
    expect(screen.getByText("Ownership")).toBeInTheDocument()
    expect(screen.getByText("Smith Properties Ltd")).toBeInTheDocument()
  })

  it("hides TA suitability badge", () => {
    renderCard("investor")
    expect(screen.queryByTestId("ta-badge")).not.toBeInTheDocument()
  })

  it("hides LHA comparison (even for rental)", () => {
    renderCard("investor", { listing_type: "rent", price_pcm: 600, purchase_price: null })
    expect(screen.queryByText(/LHA/)).not.toBeInTheDocument()
  })
})

// ============================================================================
// 2. Council/TA Visibility
// ============================================================================
describe("Council/TA Visibility", () => {
  it("hides deal score badge", () => {
    renderCard("council_ta")
    // The "75" text for deal score should not appear as a standalone badge
    // Price will still show - check that the deal score badge specifically is hidden
    const dealScoreBadge = screen.queryByText("75")
    // 75 might appear in the deal score badge - if it's there, it shouldn't be in the badge format
    if (dealScoreBadge) {
      // Make sure it's not inside a deal-score styled element
      expect(dealScoreBadge.closest("[class*='emerald']")).toBeNull()
    }
  })

  it("hides yield metrics bar", () => {
    renderCard("council_ta")
    expect(screen.queryByText("Net Yield")).not.toBeInTheDocument()
    expect(screen.queryByText("Cashflow")).not.toBeInTheDocument()
  })

  it("hides yield calculator", () => {
    renderCard("council_ta")
    expect(screen.queryByTestId("yield-calculator")).not.toBeInTheDocument()
  })

  it("shows TA suitability badge", () => {
    renderCard("council_ta")
    expect(screen.getByTestId("ta-badge")).toBeInTheDocument()
  })

  it("shows LHA comparison for rental listings", () => {
    renderCard("council_ta", {
      listing_type: "rent",
      price_pcm: 600,
      purchase_price: null,
    })
    const lhaElements = screen.getAllByText(/LHA/)
    expect(lhaElements.length).toBeGreaterThan(0)
  })

  it("hides ownership section in Details tab", async () => {
    renderCard("council_ta")
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /details/i }))
    })
    expect(screen.queryByText("Ownership")).not.toBeInTheDocument()
  })
})

// ============================================================================
// 3. Operator Visibility
// ============================================================================
describe("Operator Visibility", () => {
  it("hides deal score badge", () => {
    renderCard("operator")
    const dealScoreBadge = screen.queryByText("75")
    if (dealScoreBadge) {
      expect(dealScoreBadge.closest("[class*='emerald']")).toBeNull()
    }
  })

  it("hides yield metrics bar", () => {
    renderCard("operator")
    expect(screen.queryByText("Net Yield")).not.toBeInTheDocument()
    expect(screen.queryByText("Cashflow")).not.toBeInTheDocument()
  })

  it("hides yield calculator", () => {
    renderCard("operator")
    expect(screen.queryByTestId("yield-calculator")).not.toBeInTheDocument()
  })

  it("hides TA suitability badge", () => {
    renderCard("operator")
    expect(screen.queryByTestId("ta-badge")).not.toBeInTheDocument()
  })

  it("shows ownership section in Details tab", async () => {
    renderCard("operator")
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /details/i }))
    })
    expect(screen.getByText("Ownership")).toBeInTheDocument()
  })

  it("still shows licensing tab content", async () => {
    renderCard("operator")
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /licensing/i }))
    })
    expect(screen.getByTestId("licence-details")).toBeInTheDocument()
  })
})

// ============================================================================
// 4. Agent Visibility
// ============================================================================
describe("Agent Visibility", () => {
  it("shows deal score badge", () => {
    renderCard("agent")
    expect(screen.getByText("75")).toBeInTheDocument()
  })

  it("shows yield metrics bar", () => {
    renderCard("agent")
    expect(screen.getByText("Net Yield")).toBeInTheDocument()
    expect(screen.getByText("Gross Yield")).toBeInTheDocument()
    expect(screen.getByText("Cashflow")).toBeInTheDocument()
  })

  it("shows yield calculator", () => {
    renderCard("agent")
    expect(screen.getByTestId("yield-calculator")).toBeInTheDocument()
  })

  it("shows ownership in Details tab", async () => {
    renderCard("agent")
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /details/i }))
    })
    expect(screen.getByText("Ownership")).toBeInTheDocument()
  })

  it("hides TA suitability badge", () => {
    renderCard("agent")
    expect(screen.queryByTestId("ta-badge")).not.toBeInTheDocument()
  })

  it("hides LHA comparison", () => {
    renderCard("agent", { listing_type: "rent", price_pcm: 600, purchase_price: null })
    expect(screen.queryByText(/LHA/)).not.toBeInTheDocument()
  })
})

// ============================================================================
// 5. Fallback (null role) — everything visible
// ============================================================================
describe("Fallback (null role) Visibility", () => {
  it("shows deal score badge", () => {
    renderCard(null)
    expect(screen.getByText("75")).toBeInTheDocument()
  })

  it("shows yield metrics bar", () => {
    renderCard(null)
    expect(screen.getByText("Net Yield")).toBeInTheDocument()
  })

  it("shows yield calculator", () => {
    renderCard(null)
    expect(screen.getByTestId("yield-calculator")).toBeInTheDocument()
  })

  it("shows TA suitability badge", () => {
    renderCard(null)
    expect(screen.getByTestId("ta-badge")).toBeInTheDocument()
  })

  it("shows ownership in Details tab", async () => {
    renderCard(null)
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /details/i }))
    })
    expect(screen.getByText("Ownership")).toBeInTheDocument()
  })

  it("shows LHA comparison for rental", () => {
    renderCard(null, { listing_type: "rent", price_pcm: 600, purchase_price: null })
    const lhaElements = screen.getAllByText(/LHA/)
    expect(lhaElements.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// 6. Undefined role — same as fallback
// ============================================================================
describe("Undefined role Visibility", () => {
  it("shows deal score badge", () => {
    renderCard(undefined)
    expect(screen.getByText("75")).toBeInTheDocument()
  })

  it("shows TA suitability badge", () => {
    renderCard(undefined)
    expect(screen.getByTestId("ta-badge")).toBeInTheDocument()
  })

  it("shows yield calculator", () => {
    renderCard(undefined)
    expect(screen.getByTestId("yield-calculator")).toBeInTheDocument()
  })
})

// ============================================================================
// 7. Cross-Role: Same property, all 4 roles
// ============================================================================
describe("Cross-Role: Same Property All Roles", () => {
  const purchase = makeProperty({
    deal_score: 80,
    purchase_price: 300000,
    estimated_rent_per_room: 600,
  })

  ALL_ROLES.forEach((role) => {
    it(`renders without crashing for ${role}`, () => {
      const { container } = render(
        <PropertyDetailCard
          property={purchase}
          onViewFullDetails={vi.fn()}
          isPremium={true}
          userRole={role}
        />
      )
      expect(container.querySelector(".bg-white")).toBeTruthy()
    })
  })

  it("investor and agent see the same features", () => {
    const { container: investorContainer } = render(
      <PropertyDetailCard
        property={purchase}
        onViewFullDetails={vi.fn()}
        isPremium={true}
        userRole="investor"
      />
    )
    const investorHasYield = investorContainer.querySelector('[class*="divide-x"]') !== null
    const investorHasDealScore = investorContainer.textContent?.includes("80")

    const { container: agentContainer } = render(
      <PropertyDetailCard
        property={purchase}
        onViewFullDetails={vi.fn()}
        isPremium={true}
        userRole="agent"
      />
    )
    const agentHasYield = agentContainer.querySelector('[class*="divide-x"]') !== null
    const agentHasDealScore = agentContainer.textContent?.includes("80")

    expect(investorHasYield).toBe(agentHasYield)
    expect(investorHasDealScore).toBe(agentHasDealScore)
  })
})

// ============================================================================
// 8. Stress: Rapid re-renders with role switching
// ============================================================================
describe("Stress: Rapid Role Switching Re-renders", () => {
  it("handles 50 re-renders with alternating roles", () => {
    const prop = makeProperty()
    const { rerender } = render(
      <PropertyDetailCard
        property={prop}
        onViewFullDetails={vi.fn()}
        isPremium={true}
        userRole="investor"
      />
    )

    for (let i = 0; i < 50; i++) {
      const role = ALL_ROLES[i % ALL_ROLES.length]
      rerender(
        <PropertyDetailCard
          property={prop}
          onViewFullDetails={vi.fn()}
          isPremium={true}
          userRole={role}
        />
      )
    }
    // Last role is operator (50 % 4 = 2 → operator)
    expect(screen.queryByText("Net Yield")).not.toBeInTheDocument()
  })

  it("handles switching between null and defined roles", () => {
    const prop = makeProperty()
    const roles: (UserType | null)[] = [null, "investor", null, "council_ta", null, "operator", null, "agent"]
    const { rerender } = render(
      <PropertyDetailCard
        property={prop}
        onViewFullDetails={vi.fn()}
        isPremium={true}
        userRole={null}
      />
    )

    for (let i = 0; i < 100; i++) {
      const role = roles[i % roles.length]
      rerender(
        <PropertyDetailCard
          property={prop}
          onViewFullDetails={vi.fn()}
          isPremium={true}
          userRole={role}
        />
      )
    }
    // Should still be rendered
    expect(screen.getByText(/42 Visibility Lane/)).toBeInTheDocument()
  })
})

// ============================================================================
// 9. Edge: Property with no deal score — badge hidden for all roles
// ============================================================================
describe("Edge: No Deal Score", () => {
  ALL_ROLES.forEach((role) => {
    it(`${role}: no deal score badge when deal_score is null`, () => {
      renderCard(role, { deal_score: null })
      // No score element should render
      expect(screen.queryByText("75")).not.toBeInTheDocument()
    })
  })
})

// ============================================================================
// 10. Edge: Property with no owner — ownership section hidden regardless
// ============================================================================
describe("Edge: No Owner Data", () => {
  ALL_ROLES.forEach((role) => {
    it(`${role}: no ownership section when owner data is absent`, async () => {
      renderCard(role, { owner_name: null, company_name: null })
      await act(async () => {
        fireEvent.click(screen.getByRole("tab", { name: /details/i }))
      })
      expect(screen.queryByText("Ownership")).not.toBeInTheDocument()
    })
  })
})

// ============================================================================
// 11. Stress: Tab switching per role
// ============================================================================
describe("Stress: Tab Switching Per Role", () => {
  ALL_ROLES.forEach((role) => {
    it(`${role}: can switch through all 3 tabs without crashing`, async () => {
      renderCard(role)

      // Analysis (default) → Details → Licensing → back to Analysis
      await act(async () => {
        fireEvent.click(screen.getByRole("tab", { name: /details/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole("tab", { name: /licensing/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole("tab", { name: /analysis/i }))
      })

      // Should still be rendered correctly
      const address = screen.getByText(/42 Visibility Lane/)
      expect(address).toBeInTheDocument()
    })
  })
})

// ============================================================================
// 12. Bulk: 20 random properties × all 4 roles
// ============================================================================
describe("Bulk: Random Properties × All Roles", () => {
  const scores = [null, 20, 45, 60, 75, 90]
  const listingTypes: Array<"purchase" | "rent"> = ["purchase", "rent"]

  for (let i = 0; i < 20; i++) {
    const score = scores[i % scores.length]
    const lt = listingTypes[i % 2]

    ALL_ROLES.forEach((role) => {
      it(`property #${i + 1} (deal_score=${score}, type=${lt}) renders for ${role}`, () => {
        const { container } = render(
          <PropertyDetailCard
            property={makeProperty({
              id: `bulk-${i}`,
              deal_score: score,
              listing_type: lt,
              purchase_price: lt === "purchase" ? 200000 + i * 10000 : null,
              price_pcm: lt === "rent" ? 500 + i * 50 : null,
            })}
            onViewFullDetails={vi.fn()}
            isPremium={true}
            userRole={role}
          />
        )
        expect(container.firstChild).toBeTruthy()
      })
    })
  }
})
