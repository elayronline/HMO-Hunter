"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasValidSession, setHasValidSession] = useState(false)
  const router = useRouter()

  // Check if user has a valid session (came from reset email)
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setHasValidSession(true)
      }
      setSessionChecked(true)
    }

    checkSession()
  }, [])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)

      // Sign out and redirect to login after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push("/auth/login?message=Password reset successful. Please sign in with your new password.")
      }, 3000)
    }
  }

  // Show loading while checking session
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
          </div>
        </Card>
      </div>
    )
  }

  // Show error if no valid session
  if (!hasValidSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-100 p-4 rounded-full">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Invalid or expired link</h1>
          <p className="text-slate-600 text-sm mb-6 text-center">
            This password reset link is invalid or has expired. Please request a new one.
          </p>

          <div className="space-y-3">
            <Link href="/auth/forgot-password" className="block">
              <Button className="w-full bg-teal-600 hover:bg-teal-700">
                Request new reset link
              </Button>
            </Link>

            <Link href="/auth/login" className="block">
              <Button variant="ghost" className="w-full">
                Back to login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // Show success message
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-emerald-100 p-4 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Password reset successful!</h1>
          <p className="text-slate-600 text-sm mb-6 text-center">
            Your password has been updated. You'll be redirected to the login page in a moment.
          </p>

          <Link href="/auth/login" className="block">
            <Button className="w-full bg-teal-600 hover:bg-teal-700">
              Go to login now
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <img
            src="/apple-icon.png"
            alt="HMO Hunter"
            className="h-20 w-auto"
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Set new password</h1>
        <p className="text-slate-600 text-sm mb-6 text-center">
          Enter your new password below. Make sure it's at least 8 characters long.
        </p>

        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="border-slate-300 focus:border-teal-500 focus:ring-teal-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="border-slate-300 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>

          {/* Password requirements hint */}
          <div className="text-xs text-slate-500 space-y-1">
            <p className={password.length >= 8 ? "text-emerald-600" : ""}>
              {password.length >= 8 ? "✓" : "○"} At least 8 characters
            </p>
            <p className={password === confirmPassword && password.length > 0 ? "text-emerald-600" : ""}>
              {password === confirmPassword && password.length > 0 ? "✓" : "○"} Passwords match
            </p>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          <Button
            type="submit"
            disabled={loading || password.length < 8 || password !== confirmPassword}
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            {loading ? "Updating password..." : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  )
}
