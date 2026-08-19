"use client"

import { AlertTriangle, HelpCircle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PlanningConstraint } from "@/lib/types/database"

/**
 * Article 4 has three states and this component used to take a boolean.
 *
 * `in_force` is the only one it could express, so an address whose position has
 * never been established rendered nothing — the same silence as one checked and
 * found outside a direction. 942 of 2,958 properties are in that state, because
 * their council publishes no boundary and no page that can be read. Saying
 * nothing about them is the one thing the platform must not do: absent has to
 * be shown as absent, not left to look like a clean answer.
 *
 * `none_found` is the only verified negative, and the only state that may still
 * render nothing.
 */
export type Article4Status = "in_force" | "none_found" | "unknown" | null

interface Article4WarningProps {
  article4Status: Article4Status
  conservationArea?: boolean
  listedBuildingGrade?: "I" | "II*" | "II" | null
  planningConstraints?: PlanningConstraint[] | null
  className?: string
  variant?: "badge" | "inline"
}

export function Article4Warning({
  article4Status,
  conservationArea,
  listedBuildingGrade,
  planningConstraints,
  className = "",
  variant = "badge",
}: Article4WarningProps) {
  const article4Area = article4Status === "in_force"
  const unverified = article4Status !== "in_force" && article4Status !== "none_found"

  if (!article4Area && !unverified && !conservationArea && !listedBuildingGrade) {
    return null
  }

  const warnings: string[] = []

  if (article4Area) {
    warnings.push("Article 4 Direction")
  }
  if (conservationArea) {
    warnings.push("Conservation Area")
  }
  if (listedBuildingGrade) {
    warnings.push(`Grade ${listedBuildingGrade} Listed`)
  }

  // An unestablished position is not a restriction and must not be dressed as
  // one — it reads in slate, not amber, and says what is missing rather than
  // what applies.
  const badge = unverified && !article4Area && !warnings.length ? (
    <Badge
      variant="outline"
      className={`bg-slate-50 text-slate-600 border-slate-300 ${className}`}
    >
      <HelpCircle className="w-3 h-3 mr-1" />
      Article 4 unverified
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={`bg-amber-50 text-amber-700 border-amber-400 ${className}`}
    >
      <AlertTriangle className="w-3 h-3 mr-1" />
      {article4Area ? "Article 4" : warnings[0]}
    </Badge>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2">
            <p className="font-medium flex items-center gap-1">
              {warnings.length ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Planning Restrictions Apply
                </>
              ) : (
                <>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  Planning Position Not Established
                </>
              )}
            </p>

            {unverified && (
              <div className="text-sm">
                <p className="font-medium text-slate-600">Article 4 unverified</p>
                <p className="text-muted-foreground">
                  No Article 4 position is held for this address. Its council
                  publishes no boundary data we can read, so nothing has been
                  established either way. This is not the same as being checked
                  and found outside a direction — confirm with the council
                  before relying on it.
                </p>
              </div>
            )}

            {article4Area && (
              <div className="text-sm">
                <p className="font-medium text-amber-600">Article 4 Direction</p>
                <p className="text-muted-foreground">
                  Planning permission is required to convert this property to an HMO.
                  This removes permitted development rights for C3 to C4 use class changes.
                </p>
              </div>
            )}

            {conservationArea && (
              <div className="text-sm">
                <p className="font-medium text-blue-600">Conservation Area</p>
                <p className="text-muted-foreground">
                  Additional planning controls apply. External alterations may require permission.
                </p>
              </div>
            )}

            {listedBuildingGrade && (
              <div className="text-sm">
                <p className="font-medium text-purple-600">
                  Grade {listedBuildingGrade} Listed Building
                </p>
                <p className="text-muted-foreground">
                  Listed building consent required for most alterations.
                  Strict heritage protection applies.
                </p>
              </div>
            )}

            {planningConstraints && planningConstraints.length > 0 && (
              <div className="text-sm border-t pt-2 mt-2">
                <p className="font-medium mb-1">All Constraints:</p>
                <ul className="space-y-1">
                  {planningConstraints.map((constraint, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span>
                        <span className="font-medium">{constraint.type}:</span>{" "}
                        {constraint.description}
                        {constraint.reference && (
                          <span className="text-muted-foreground"> ({constraint.reference})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground border-t pt-2">
              Consult the local planning authority before proceeding with any HMO conversion.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
