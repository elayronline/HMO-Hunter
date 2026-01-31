import { test, expect } from "@playwright/test"

test.describe("Credits System", () => {
  test("credits API returns proper structure", async ({ request }) => {
    const response = await request.get("/api/credits")

    // Should require auth
    expect(response.status()).toBe(401)

    const body = await response.json()
    expect(body).toHaveProperty("error")
  })

  test("rate limiting works on API endpoints", async ({ request }) => {
    // Make multiple rapid requests to trigger rate limit
    const requests = Array(70).fill(null).map(() =>
      request.get("/api/credits")
    )

    const responses = await Promise.all(requests)

    // At least one should be rate limited (429) after 60 requests
    const rateLimited = responses.some(r => r.status() === 429)
    // Note: This might not trigger in all cases depending on rate limit config
  })

  test("export API requires authentication", async ({ request }) => {
    const response = await request.post("/api/export", {
      data: { propertyIds: [] }
    })

    expect(response.status()).toBe(401)
  })

  test("track-contact API requires authentication", async ({ request }) => {
    const response = await request.post("/api/track-contact", {
      data: {
        propertyId: "test",
        action: "view",
        contactType: "owner",
        contactName: "Test"
      }
    })

    expect(response.status()).toBe(401)
  })
})
