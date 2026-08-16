"use client"

/**
 * What this property is being used as today, and what says so.
 *
 * The first thing a sourcer needs from a listing is whether they are looking at
 * an HMO that already exists or a building that would have to become one. Those
 * are different jobs with different risks, and the map was answering neither:
 * the licence block only rendered for properties with listing_type "purchase",
 * so all 457 off-market licensed HMOs — the ones the platform exists to surface
 * — displayed no licence information at all.
 *
 * The claim and its evidence are shown together on purpose. "Existing HMO" on
 * its own is an assertion; "Existing HMO — licence BRS-HMO-598978, Bristol,
 * expires 12 March 2027, 5 occupants" is a fact someone can check. Where the
 * evidence does not exist, this says that instead of filling the gap.
 */

import { assessUseClass, USE_CLASS_LABELS, type UseClassInput } from "@/lib/properties/use-class"
import {
  categorise,
  licenceExpiry,
  licenceReference,
  type CategorisableProperty,
} from "@/lib/properties/category"
import { CheckCircle2, AlertTriangle, HelpCircle, Building2, Clock } from "lucide-react"

/*
 * licence_id, licence_start_date, licence_end_date and max_occupants are
 * deliberately absent. Every value in those columns came from
 * scripts/DO_NOT_RUN_012_populate_licence_term_data.sql — see licenceExpiry() in
 * lib/properties/category.ts — and this panel exists to show evidence a reader
 * can check against the council's register. An MD5 of the address and a
 * bedrooms + 1 occupancy are the opposite of that.
 */
export interface CurrentUseProperty extends UseClassInput {
  hmo_licence_reference?: string | null
  hmo_licence_expiry?: string | null
  hmo_council?: string | null
  article_4_council?: string | null
  bedrooms?: number | null
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** One line of evidence: what it is, and the value a reader could verify. */
function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-[11px] font-medium text-slate-800">{value}</span>
    </div>
  )
}

export function CurrentUsePanel({ property }: { property: CurrentUseProperty }) {
  const use = assessUseClass(property)
  // Derived from the expiry date rather than the stored status, for the same
  // reason the Article 4 force state is: a licence that ran out last April is
  // expired whatever the row still says.
  const { licence } = categorise(property as CategorisableProperty)
  const expired = licence === "licence_expired"
  const ending = licence === "licence_ending"
  const inHmoUse = licence !== "unlicensed"

  const reference = licenceReference(property)
  const council = property.hmo_council ?? property.article_4_council ?? null
  const end = formatDate(licenceExpiry(property))

  // Three headline states, and the third is not a softer version of the second.
  const state = inHmoUse
    ? expired
      ? {
          title: "Existing HMO — licence expired",
          tone: "warn" as const,
          Icon: AlertTriangle,
          summary:
            "This property has been in HMO use and held a licence that has since expired. Operating without one is an offence, so the position needs confirming with the council before it means anything to a buyer.",
        }
      : ending
        ? {
            title: "Existing HMO — licence ending",
            tone: "warn" as const,
            Icon: Clock,
            summary:
              "A council HMO licence is recorded and runs out within six months. A renewal deadline is the owner's deadline too, which is often what makes them willing to talk.",
          }
        : {
            title: "Existing HMO — licensed",
            tone: "good" as const,
            Icon: CheckCircle2,
            summary:
              "A council HMO licence is recorded against this address, which is what establishes it as an operating HMO rather than a conversion candidate.",
          }
    : use.useClass === "E"
      ? {
          title: "Not an HMO — commercial",
          tone: "neutral" as const,
          Icon: Building2,
          summary:
            "No HMO licence is recorded and the property is commercial stock. Becoming an HMO would mean a change of use, which turns on the planning route rather than on the building.",
        }
      : {
          title: "Not a recorded HMO",
          tone: "neutral" as const,
          Icon: HelpCircle,
          summary:
            "No HMO licence is recorded against this address. That is not proof it has never been in HMO use — only that no licence appears on the register we hold.",
        }

  const toneClass = {
    good: "border-teal-200 bg-teal-50/60",
    warn: "border-amber-200 bg-amber-50/60",
    neutral: "border-slate-200 bg-slate-50",
  }[state.tone]

  const iconClass = {
    good: "text-teal-700",
    warn: "text-amber-600",
    neutral: "text-slate-400",
  }[state.tone]

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-start gap-2">
        <state.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{state.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{state.summary}</p>
        </div>
      </div>

      {/* The evidence for the claim above, so it can be checked rather than
          taken on trust. Only rows we actually hold are rendered. */}
      {inHmoUse && (reference || council || end) && (
        <div className="mt-2.5 divide-y divide-slate-200/70 border-t border-slate-200/70 pt-1.5">
          {reference && <Evidence label="Licence reference" value={reference} />}
          {council && <Evidence label="Issuing council" value={council} />}
          {end && (
            <Evidence
              label={expired ? "Licence expired" : "Licence expires"}
              value={end}
            />
          )}
        </div>
      )}

      {/* Use class last, because it is a conclusion drawn from the evidence
          above rather than another piece of it — and it carries how firm that
          conclusion is. */}
      <div className="mt-2.5 border-t border-slate-200/70 pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] text-slate-500">Planning use class</span>
          <span className="text-right text-[11px] font-semibold text-slate-800">
            {USE_CLASS_LABELS[use.useClass]}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          {use.reason}
        </p>
        {use.basis !== "recorded" && (
          <p className="mt-1 text-[10px] font-medium text-amber-700">
            {use.basis === "inferred"
              ? "Read from the property's size, not from a record of its use."
              : "Not established — confirm the lawful use with the council."}
          </p>
        )}
      </div>
    </div>
  )
}
