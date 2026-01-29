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

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || "http://localhost:3000/auth/callback"

    console.log("[v0] Sign up with redirect URL:", redirectUrl)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: redirectUrl,
      },
    })

    console.log("[v0] Sign up response:", { data, error })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (data.user && data.session) {
        console.log("[v0] User auto-confirmed, redirecting to home")

        // Wait for session to be set in cookies
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Use window.location.href for a hard redirect
        window.location.href = "/"
      } else {
        // User needs to confirm email
        console.log("[v0] User needs email confirmation")
        setSuccess(true)
        setLoading(false)
      }
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-600 mb-6">
            We've sent you a confirmation email to <strong>{email}</strong>. Please check your inbox and click the link
            to verify your account.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Don't see the email? Check your spam folder or try signing up again.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.push("/auth/login")} className="bg-teal-600 hover:bg-teal-700">
              Go to login
            </Button>
            <Button
              onClick={() => setSuccess(false)}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Back to sign up
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <img
            src="/hmo-hunter-logo.png"
            alt="HMO Hunter"
            className="h-20 w-auto"
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Create an account</h1>
        <p className="text-slate-600 text-sm mb-6 text-center">Start finding your perfect HMO property today</p>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              className="border-slate-300 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>

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
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              className="border-slate-300 focus:border-teal-500 focus:ring-teal-500"
            />
            <p className="text-xs text-slate-500">Password must be at least 6 characters</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <p className="font-medium">Sign up error:</p>
              <p>{error}</p>
              {error.includes("email") && (
                <p className="mt-2 text-xs">
                  If you're in development and emails aren't working, you can disable email confirmation in your
                  Supabase project settings.
                </p>
              )}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-slate-600 text-center mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-teal-600 hover:text-teal-700 font-medium">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
