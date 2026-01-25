"use client"

import { AlertTriangle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PlanningConstraint } from "@/lib/types/database"

interface Article4WarningProps {
  article4Area: boolean
  conservationArea?: boolean
  listedBuildingGrade?: "I" | "II*" | "II" | null
  planningConstraints?: PlanningConstraint[] | null
  className?: string
  variant?: "badge" | "inline"
}

export function Article4Warning({
  article4Area,
  conservationArea,
  listedBuildingGrade,
  planningConstraints,
  className = "",
  variant = "badge",
}: Article4WarningProps) {
  if (!article4Area && !conservationArea && !listedBuildingGrade) {
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

  const badge = (
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
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Planning Restrictions Apply
            </p>

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
