"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { track } from "@vercel/analytics"
import { CheckCircle2, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const ORG_TYPES = [
  "Local Authority",
  "Housing Association",
  "Private Investor / Landlord",
  "Council Housing Team",
  "Property Agent / Sourcer",
  "Other",
]

const REGIONS = [
  "London",
  "South East",
  "South West",
  "East of England",
  "West Midlands",
  "East Midlands",
  "Yorkshire & Humber",
  "North West",
  "North East",
  "Wales",
  "Scotland",
  "Northern Ireland",
]

type FormState = "idle" | "submitting" | "success" | "error"

export function SignupForm() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [orgType, setOrgType] = useState("")
  const [region, setRegion] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState<FormState>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("submitting")
    setErrorMsg("")
    track("signup_submit", { org_type: orgType, region: region || "not_set" })

    const supabase = createClient()

    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          org_type: orgType,
          region: region || undefined,
        },
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) {
      if (error.status === 429 || error.message.includes("rate")) {
        setErrorMsg("Too many attempts. Please wait a moment and try again.")
      } else if (error.message.includes("already registered")) {
        setErrorMsg("An account with this email already exists. Try signing in instead.")
      } else {
        setErrorMsg(error.message)
      }
      track("signup_error", { error: error.message.slice(0, 100) })
      setState("error")
      return
    }

    track("signup_success", { org_type: orgType })
    if (data.user && data.session) {
      // Auto-confirmed, redirect to app
      await new Promise((resolve) => setTimeout(resolve, 100))
      window.location.href = "/map"
    } else {
      setState("success")
    }
  }

  if (state === "success") {
    return (
      <div id="signup-success" className="py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md rounded-2xl border border-[var(--grey-200)] bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--teal-pale)]">
            <CheckCircle2 className="h-8 w-8 text-[var(--teal)]" />
          </div>
          <h3 className="text-xl font-bold text-[var(--grey-900)]">Check your email</h3>
          <p className="mt-3 text-sm text-[var(--grey-500)]">
            We've sent a confirmation link to <strong className="text-[var(--grey-700)]">{email}</strong>.
            Click the link to verify your account, then sign in.
          </p>
          <p className="mt-4 text-xs text-[var(--grey-400)]">
            Don't see it? Check your spam folder.
          </p>
          <a
            href="/auth/login"
            className="mt-5 inline-block rounded-xl border border-[var(--grey-200)] px-6 py-2.5 text-sm font-medium text-[var(--grey-700)] hover:bg-[var(--grey-50)] transition-colors"
          >
            Go to login
          </a>
        </motion.div>
      </div>
    )
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--grey-200)] bg-white px-4 py-3 text-sm text-[var(--grey-800)] placeholder:text-[var(--grey-400)] focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal-pale)] outline-none transition-colors"
  const labelCls = "block text-sm font-semibold text-[var(--grey-600)] mb-1.5"

  return (
    <div id="signup-form" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-lg rounded-2xl border border-[var(--grey-200)] bg-white p-8 shadow-sm"
      >
        <h3 className="text-center font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-[var(--grey-900)]">
          Create Your Account
        </h3>
        <p className="mt-1 text-center text-sm text-[var(--grey-500)]">
          10 seconds. 5 fields. You're in.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="sf-name" className={labelCls}>Full Name</label>
            <input
              id="sf-name"
              type="text"
              required
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
              disabled={state === "submitting"}
            />
          </div>

          <div>
            <label htmlFor="sf-email" className={labelCls}>Email</label>
            <input
              id="sf-email"
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              disabled={state === "submitting"}
            />
          </div>

          <div>
            <label htmlFor="sf-password" className={labelCls}>Password</label>
            <div className="relative">
              <input
                id="sf-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-10`}
                disabled={state === "submitting"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--grey-400)] hover:text-[var(--grey-600)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="sf-org" className={labelCls}>Organisation Type</label>
            <select
              id="sf-org"
              required
              value={orgType}
              onChange={(e) => setOrgType(e.target.value)}
              className={inputCls}
              disabled={state === "submitting"}
            >
              <option value="">Select type</option>
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sf-region" className={labelCls}>Region</label>
            <select
              id="sf-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={inputCls}
              disabled={state === "submitting"}
            >
              <option value="">Select region (optional)</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {state === "error" && errorMsg && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-xl bg-[var(--teal-dark)] py-3 text-sm font-semibold text-white hover:bg-[var(--teal)] transition-colors disabled:opacity-60"
          >
            {state === "submitting" ? "Creating account..." : "Secure My Spot"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--grey-400)]">
          No card required. Already have an account?{" "}
          <a href="/auth/login" className="font-medium text-[var(--teal-dark)] hover:underline">
            Sign in
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-[var(--grey-400)]">
          Built for local authority sourcers, housing associations, investors, and council teams.
        </p>
      </motion.div>
    </div>
  )
}
