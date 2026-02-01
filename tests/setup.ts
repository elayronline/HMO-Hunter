import { expect, afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
