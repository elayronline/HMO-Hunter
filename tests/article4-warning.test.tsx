import { describe, it, expect } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { Article4Warning } from "@/components/article4-warning"

/**
 * The component took a boolean, so it could only ever say "in force" or say
 * nothing. Nothing was also the answer for the 942 addresses whose council
 * publishes no boundary — the same silence as the 536 checked and found outside
 * a direction.
 */
describe("Article4Warning", () => {
  it("names a direction that is in force", () => {
    render(<Article4Warning article4Status="in_force" />)
    expect(screen.getByText("Article 4")).toBeInTheDocument()
  })

  it("says so when no position has been established", () => {
    render(<Article4Warning article4Status="unknown" />)
    expect(screen.getByText("Article 4 unverified")).toBeInTheDocument()
  })

  it("treats a missing status as unestablished rather than as clear", () => {
    render(<Article4Warning article4Status={null} />)
    expect(screen.getByText("Article 4 unverified")).toBeInTheDocument()
  })

  it("stays silent only for the verified negative", () => {
    const { container } = render(<Article4Warning article4Status="none_found" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("still reports other constraints when Article 4 is verified clear", () => {
    render(<Article4Warning article4Status="none_found" conservationArea />)
    expect(screen.getByText("Conservation Area")).toBeInTheDocument()
    expect(screen.queryByText("Article 4 unverified")).not.toBeInTheDocument()
  })

  it("does not dress an unestablished position as a restriction", () => {
    render(<Article4Warning article4Status="unknown" />)
    const badge = screen.getByText("Article 4 unverified").closest("div")
    expect(badge?.className).not.toContain("amber")
  })
})
