'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from './use-toast'

export interface CreditStatus {
  role: 'admin' | 'standard_pro'
  isAdmin: boolean
  credits: {
    remaining: number
    total: number
    used: number
    percentUsed: number
  }
  freePropertyViews: {
    remaining: number
    total: number
    used: number
  }
  resources: {
    savedProperties: { current: number; limit: number }
    savedSearches: { current: number; limit: number }
    priceAlerts: { current: number; limit: number }
  }
  isWarning: boolean
  isBlocked: boolean
  resetIn: string
  resetAt: string
}

interface UseCreditsReturn {
  credits: CreditStatus | null
  isLoading: boolean
  error: string | null
  refreshCredits: () => Promise<void>
  checkAndDeduct: (action: string, onSuccess?: () => void) => Promise<boolean>
  showCreditWarning: (remaining: number, total: number) => void
  showCreditBlocked: (resetAt: string) => void
  showResourceLimitWarning: (resource: string, current: number, limit: number) => void
  showResourceLimitBlocked: (resource: string, limit: number) => void
}

export function useCredits(): UseCreditsReturn {
  const [credits, setCredits] = useState<CreditStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCredits = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/credits')

      if (!response.ok) {
        if (response.status === 401) {
          // User not logged in - that's fine
          setCredits(null)
          return
        }
        throw new Error('Failed to fetch credits')
      }

      const data = await response.json()
      setCredits(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCredits()
  }, [refreshCredits])

  const showCreditWarning = useCallback((remaining: number, total: number) => {
    toast({
      title: "Credits Running Low",
      description: `You have ${remaining} of ${total} credits remaining today. Resets at midnight UTC.`,
      variant: "default",
    })
  }, [])

  const showCreditBlocked = useCallback((resetAt: string) => {
    const resetTime = new Date(resetAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
    toast({
      title: "Daily Limit Reached",
      description: `You've used all your credits for today. Resets at ${resetTime}.`,
      variant: "destructive",
    })
  }, [])

  const showResourceLimitWarning = useCallback((resource: string, current: number, limit: number) => {
    const resourceName = resource.replace(/_/g, ' ')
    toast({
      title: `${resourceName} Limit Warning`,
      description: `You've used ${current} of ${limit} ${resourceName}.`,
      variant: "default",
    })
  }, [])

  const showResourceLimitBlocked = useCallback((resource: string, limit: number) => {
    const resourceName = resource.replace(/_/g, ' ')
    toast({
      title: `${resourceName} Limit Reached`,
      description: `You've reached your limit of ${limit} ${resourceName}. Remove some to add more.`,
      variant: "destructive",
    })
  }, [])

  const checkAndDeduct = useCallback(async (
    action: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    // If user is admin, always allow
    if (credits?.isAdmin) {
      onSuccess?.()
      return true
    }

    // Check if we have credit info
    if (!credits) {
      // Try to refresh
      await refreshCredits()
      return false
    }

    // Check if blocked
    if (credits.isBlocked) {
      showCreditBlocked(credits.resetAt)
      return false
    }

    // Show warning at 80%
    if (credits.isWarning) {
      showCreditWarning(credits.credits.remaining, credits.credits.total)
    }

    onSuccess?.()
    return true
  }, [credits, refreshCredits, showCreditBlocked, showCreditWarning])

  return {
    credits,
    isLoading,
    error,
    refreshCredits,
    checkAndDeduct,
    showCreditWarning,
    showCreditBlocked,
    showResourceLimitWarning,
    showResourceLimitBlocked,
  }
}

// Context for app-wide credit state
import { createContext, useContext, ReactNode } from 'react'

const CreditsContext = createContext<UseCreditsReturn | null>(null)

export function CreditsProvider({ children }: { children: ReactNode }) {
  const creditsState = useCredits()

  return (
    <CreditsContext.Provider value={creditsState}>
      {children}
    </CreditsContext.Provider>
  )
}

export function useCreditsContext(): UseCreditsReturn {
  const context = useContext(CreditsContext)
  if (!context) {
    throw new Error('useCreditsContext must be used within a CreditsProvider')
  }
  return context
}
