"use client"

import { useState, useEffect } from "react"
import {
  Shield,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { LicenceType } from "@/lib/types/licences"
import { DEFAULT_LICENCE_TYPES } from "@/lib/types/licences"

// Storage key for persisting preferences
const STORAGE_KEY = "hmo_hunter_licence_preferences"

export interface LicenceFilterState {
  enabledTypes: string[]
  showExpired: boolean
  showUnknown: boolean
}

interface LicenceFilterTogglesProps {
  licenceTypes?: LicenceType[]
  initialState?: LicenceFilterState
  onChange: (state: LicenceFilterState) => void
  propertyCounts?: Record<string, number> // Count of properties per licence type
}

const iconMap: Record<string, React.ElementType> = {
  mandatory_hmo: Shield,
  additional_hmo: ShieldCheck,
  selective_licence: FileCheck,
  article_4: AlertTriangle,
  scottish_hmo: Shield,
  ni_hmo: Shield,
}

export function LicenceFilterToggles({
  licenceTypes,
  initialState,
  onChange,
  propertyCounts = {},
}: LicenceFilterTogglesProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [filterState, setFilterState] = useState<LicenceFilterState>(() => {
    // Try to load from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Ignore parse errors
        }
      }
    }
    // Default state
    return initialState || {
      enabledTypes: (licenceTypes || DEFAULT_LICENCE_TYPES).map((t) =>
        typeof t === "string" ? t : t.code
      ),
      showExpired: true,
      showUnknown: true,
    }
  })

  // Use default licence types if none provided
  const types = licenceTypes || DEFAULT_LICENCE_TYPES.map((t) => ({
    ...t,
    id: t.code,
    created_at: new Date().toISOString(),
  }))

  // Persist to localStorage when state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filterState))
    }
    onChange(filterState)
  }, [filterState, onChange])

  const toggleLicenceType = (code: string) => {
    setFilterState((prev) => ({
      ...prev,
      enabledTypes: prev.enabledTypes.includes(code)
        ? prev.enabledTypes.filter((c) => c !== code)
        : [...prev.enabledTypes, code],
    }))
  }

  const toggleShowExpired = (checked: boolean) => {
    setFilterState((prev) => ({ ...prev, showExpired: checked }))
  }

  const toggleShowUnknown = (checked: boolean) => {
    setFilterState((prev) => ({ ...prev, showUnknown: checked }))
  }

  const selectAll = () => {
    setFilterState((prev) => ({
      ...prev,
      enabledTypes: types.map((t) => t.code),
    }))
  }

  const selectNone = () => {
    setFilterState((prev) => ({
      ...prev,
      enabledTypes: [],
    }))
  }

  const resetToDefaults = () => {
    const defaultState: LicenceFilterState = {
      enabledTypes: types.map((t) => t.code),
      showExpired: true,
      showUnknown: true,
    }
    setFilterState(defaultState)
  }

  const enabledCount = filterState.enabledTypes.length
  const totalCount = types.length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-2 h-auto"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Licence Types</span>
            <Badge variant="secondary" className="text-xs">
              {enabledCount}/{totalCount}
            </Badge>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3">
        {/* Quick Actions */}
        <div className="flex items-center gap-2 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={selectAll}
          >
            <Eye className="h-3 w-3 mr-1" />
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={selectNone}
          >
            <EyeOff className="h-3 w-3 mr-1" />
            None
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 ml-auto"
            onClick={resetToDefaults}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>

        {/* Licence Type Toggles */}
        <div className="space-y-1 px-2">
          {types.map((type) => {
            const Icon = iconMap[type.code] || Shield
            const isEnabled = filterState.enabledTypes.includes(type.code)
            const count = propertyCounts[type.code] || 0

            return (
              <div
                key={type.code}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                  isEnabled ? "bg-primary/5" : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${
                    isEnabled ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={`licence-${type.code}`}
                      className={`text-sm cursor-pointer truncate block ${
                        isEnabled ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {type.name}
                    </Label>
                    {type.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {type.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  )}
                  <Switch
                    id={`licence-${type.code}`}
                    checked={isEnabled}
                    onCheckedChange={() => toggleLicenceType(type.code)}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Status Filters */}
        <div className="border-t pt-3 px-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Status Filters
          </p>

          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <Label htmlFor="show-expired" className="text-sm cursor-pointer">
                Show Expired
              </Label>
            </div>
            <Switch
              id="show-expired"
              checked={filterState.showExpired}
              onCheckedChange={toggleShowExpired}
            />
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gray-400" />
              <Label htmlFor="show-unknown" className="text-sm cursor-pointer">
                Show Unknown Status
              </Label>
            </div>
            <Switch
              id="show-unknown"
              checked={filterState.showUnknown}
              onCheckedChange={toggleShowUnknown}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Hook for using licence filter state
export function useLicenceFilterState(initialState?: LicenceFilterState) {
  const [state, setState] = useState<LicenceFilterState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Ignore
        }
      }
    }
    return initialState || {
      enabledTypes: DEFAULT_LICENCE_TYPES.map((t) => t.code),
      showExpired: true,
      showUnknown: true,
    }
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  return [state, setState] as const
}
