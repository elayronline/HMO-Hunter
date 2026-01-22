"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log("[v0] Login attempt for:", email)

    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log("[v0] Login error:", error.message)
      setError(error.message)
      setLoading(false)
    } else {
      console.log("[v0] Login successful, user:", data.user?.email)
      console.log("[v0] Session:", data.session ? "exists" : "missing")

      // Wait for session to be set in cookies before redirecting
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Use window.location.href for a hard redirect to ensure session is loaded
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-teal-500 rounded-lg"></div>
            <svg
              className="absolute inset-0 w-10 h-10"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 8L10 14V24H14V18H22V24H26V14L18 8Z"
                fill="white"
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <circle cx="22" cy="22" r="8" fill="white" fillOpacity="0.3" />
              <path
                d="M22 18C20.34 18 19 19.34 19 21C19 22.66 20.34 24 22 24C23.66 24 25 22.66 25 21C25 19.34 23.66 18 22 18ZM22 22.5C21.17 22.5 20.5 21.83 20.5 21C20.5 20.17 21.17 19.5 22 19.5C22.83 19.5 23.5 20.17 23.5 21C23.5 21.83 22.83 22.5 22 22.5Z"
                fill="white"
              />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">HMO</span>
            <span className="text-2xl font-bold text-teal-600">Hunter</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Welcome back</h1>
        <p className="text-slate-600 text-sm mb-6 text-center">Sign in to your account to continue</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="border-slate-300 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="border-slate-300 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-slate-600 text-center mt-6">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="text-teal-600 hover:text-teal-700 font-medium">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  )
}
