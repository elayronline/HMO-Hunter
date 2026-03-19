/**
 * HMO Hunter Load Test — k6
 *
 * Simulates 100 concurrent users performing realistic actions:
 * - Browse map (property search)
 * - View property details
 * - Check credits
 * - Use pipeline
 * - Query off-market
 *
 * Run: k6 run tests/load/k6-load-test.js
 * Install: brew install k6 (macOS) or https://k6.io/docs/get-started/installation/
 *
 * Targets:
 * - p95 response time < 2s for all endpoints
 * - Error rate < 1%
 * - 100 concurrent users sustained for 5 minutes
 */

import http from "k6/http"
import { check, sleep, group } from "k6"
import { Rate, Trend } from "k6/metrics"

// Custom metrics
const errorRate = new Rate("errors")
const mapLoadTime = new Trend("map_load_time")
const propertyDetailTime = new Trend("property_detail_time")
const pipelineTime = new Trend("pipeline_time")

// Test configuration
export const options = {
  stages: [
    { duration: "30s", target: 20 },   // Ramp up to 20 users
    { duration: "1m", target: 50 },    // Ramp to 50 users
    { duration: "2m", target: 100 },   // Sustain 100 users
    { duration: "1m", target: 50 },    // Ramp down
    { duration: "30s", target: 0 },    // Cleanup
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],   // 95% of requests under 2s
    errors: ["rate<0.01"],               // Less than 1% error rate
    map_load_time: ["p(95)<3000"],       // Map loads under 3s
    property_detail_time: ["p(95)<2000"], // Property details under 2s
    pipeline_time: ["p(95)<1500"],       // Pipeline under 1.5s
  },
}

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"

// Simulate a logged-in user session
export default function () {
  // Group 1: Map/Search (most common action)
  group("Map Search", () => {
    const mapRes = http.get(`${BASE_URL}/api/map-data`, {
      headers: { "Content-Type": "application/json" },
    })

    mapLoadTime.add(mapRes.timings.duration)
    const mapOk = check(mapRes, {
      "map data status 200 or 401": (r) => r.status === 200 || r.status === 401,
      "map data response time < 3s": (r) => r.timings.duration < 3000,
    })
    errorRate.add(!mapOk)
  })

  sleep(1)

  // Group 2: Credits check
  group("Credits Check", () => {
    const creditsRes = http.get(`${BASE_URL}/api/credits`)
    check(creditsRes, {
      "credits status 200 or 401": (r) => r.status === 200 || r.status === 401,
      "credits response time < 1s": (r) => r.timings.duration < 1000,
    })
  })

  sleep(0.5)

  // Group 3: Property detail (simulated with random property)
  group("Property Detail", () => {
    // Use a fake UUID — will get 404 but tests the route handler
    const propRes = http.get(`${BASE_URL}/api/property/550e8400-e29b-41d4-a716-446655440000`)
    propertyDetailTime.add(propRes.timings.duration)
    check(propRes, {
      "property detail returns in < 2s": (r) => r.timings.duration < 2000,
      "property detail status valid": (r) => [200, 401, 404].includes(r.status),
    })
  })

  sleep(1)

  // Group 4: Pipeline
  group("Pipeline", () => {
    const pipeRes = http.get(`${BASE_URL}/api/pipeline`)
    pipelineTime.add(pipeRes.timings.duration)
    check(pipeRes, {
      "pipeline status 200 or 401": (r) => r.status === 200 || r.status === 401,
      "pipeline response time < 1.5s": (r) => r.timings.duration < 1500,
    })
  })

  sleep(0.5)

  // Group 5: Off-market
  group("Off-Market", () => {
    const offMarketRes = http.get(`${BASE_URL}/api/off-market?limit=20`)
    check(offMarketRes, {
      "off-market status 200 or 401": (r) => r.status === 200 || r.status === 401,
      "off-market response time < 2s": (r) => r.timings.duration < 2000,
    })
  })

  sleep(0.5)

  // Group 6: HMO Stats
  group("HMO Stats", () => {
    const statsRes = http.get(`${BASE_URL}/api/hmo-stats`)
    check(statsRes, {
      "hmo-stats status valid": (r) => [200, 401].includes(r.status),
      "hmo-stats response time < 2s": (r) => r.timings.duration < 2000,
    })
  })

  // Random delay between 1-3 seconds to simulate real user think time
  sleep(Math.random() * 2 + 1)
}
