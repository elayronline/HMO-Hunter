import {
  Sparkles,
  Filter,
  MapPin,
  FileText,
  Bookmark,
  Crown,
  TrendingUp,
  ShieldCheck,
  Target,
} from "lucide-react"
import type { UserType } from "@/components/role-selection-modal"

export type HighlightPosition =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-center"
  | "center-left"
  | "center-right"

export type ArrowDirection = "up" | "down" | "left" | "right" | "none"

export interface Step {
  icon: typeof Sparkles
  title: string
  description: string
  color: string
  bgColor: string
  highlight: HighlightPosition
  arrow: ArrowDirection
  targetHint: string
  showPropertyDetails?: boolean
}

// ---------------------------------------------------------------------------
// Investor steps (7)
// ---------------------------------------------------------------------------
const investorSteps: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description:
      "Your smart platform for finding HMO investment opportunities. Let's take a quick tour tailored to property investors.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
  {
    icon: Filter,
    title: "Search & Filters",
    description:
      "Set your purchase price range, filter by property type, and focus on areas with the best investment potential. Your filters auto-default to purchase listings.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    highlight: "center-left",
    arrow: "left",
    targetHint: "The filter panel is on the left side",
  },
  {
    icon: MapPin,
    title: "Property Map",
    description:
      "The map shows all properties. Teal pins = Licensed HMOs, Green pins = Opportunities, Red pins = Article 4 restricted areas.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Click any pin to view property details",
  },
  {
    icon: TrendingUp,
    title: "Yield & Deal Scores",
    description:
      "Every property shows a deal score and gross yield estimate. Use the yield calculator on any property to model your cashflow, ROI, and break-even point.",
    color: "text-green-600",
    bgColor: "bg-green-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Look for the deal score badge on each property",
  },
  {
    icon: FileText,
    title: "Quick Filter Tabs",
    description:
      "Use tabs to quickly filter: Licensed HMOs for stable lets, Opportunities for conversion targets, or Restricted to check Article 4 zones before purchasing.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    highlight: "bottom-center",
    arrow: "up",
    targetHint: "Tabs are at the top-center of the map",
  },
  {
    icon: Bookmark,
    title: "Property Details",
    description:
      "Click any pin to open full details. View purchase price, estimated yield, owner contact data, EPC rating, and save properties to your shortlist.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    highlight: "center-left",
    arrow: "right",
    targetHint: "Details panel is now open on the right",
    showPropertyDetails: true,
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description:
      "Start exploring investment opportunities! Click any pin on the map to begin. Your credit balance is shown in the top bar.",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
]

// ---------------------------------------------------------------------------
// Council / TA steps (7)
// ---------------------------------------------------------------------------
const councilTaSteps: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description:
      "Your smart platform for sourcing temporary accommodation. Let's take a quick tour tailored to council and TA officers.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
  {
    icon: Filter,
    title: "Search & Filters",
    description:
      "Filters auto-default to rental listings. Set your budget range, minimum bedrooms, and use the TA Suitability filter to find properties matching LHA rates.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    highlight: "center-left",
    arrow: "left",
    targetHint: "The filter panel is on the left side",
  },
  {
    icon: MapPin,
    title: "Property Map",
    description:
      "The map shows all properties. Teal pins = Licensed HMOs, Green pins = Opportunities. Licensed properties are safest for TA placements.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Click any pin to view property details",
  },
  {
    icon: ShieldCheck,
    title: "TA Suitability & LHA Rates",
    description:
      "Each property is auto-scored for TA suitability based on 5 criteria: rental availability, active licence, adequate EPC, bedroom count, and LHA budget fit.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Look for the TA suitability badge on each property",
  },
  {
    icon: FileText,
    title: "Quick Filter Tabs",
    description:
      "Use the Licensed tab to find actively licensed HMOs suitable for placements. Check the Expired tab for properties that may need licence renewal.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    highlight: "bottom-center",
    arrow: "up",
    targetHint: "Tabs are at the top-center of the map",
  },
  {
    icon: Bookmark,
    title: "Property Details",
    description:
      "Click any pin to see rent PCM, licence status, EPC rating, bedroom count, and the TA suitability assessment with LHA rate comparison.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    highlight: "center-left",
    arrow: "right",
    targetHint: "Details panel is now open on the right",
    showPropertyDetails: true,
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description:
      "Start sourcing TA properties! Click any pin on the map to begin. Your credit balance is shown in the top bar.",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
]

// ---------------------------------------------------------------------------
// Operator steps (7)
// ---------------------------------------------------------------------------
const operatorSteps: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description:
      "Your smart platform for managing HMO portfolios. Let's take a quick tour tailored to property managers.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
  {
    icon: Filter,
    title: "Search & Filters",
    description:
      "Filter by licence type, expiry date range, and minimum bedrooms (defaults to 3+). Use the licence expiry filter to track upcoming renewals.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    highlight: "center-left",
    arrow: "left",
    targetHint: "The filter panel is on the left side",
  },
  {
    icon: MapPin,
    title: "Property Map",
    description:
      "The map shows all properties. Teal pins = Licensed HMOs, Green pins = Opportunities. Focus on teal pins for your compliant portfolio.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Click any pin to view property details",
  },
  {
    icon: ShieldCheck,
    title: "Licence Tracking & Compliance",
    description:
      "Track licence status, expiry dates, and EPC ratings across properties. The licence expiry filter lets you find HMOs expiring within a specific month range.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Look for licence status badges on each property",
  },
  {
    icon: FileText,
    title: "Quick Filter Tabs",
    description:
      "Use the Expired tab to quickly find properties with lapsed licences. The Licensed tab shows your compliant portfolio at a glance.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    highlight: "bottom-center",
    arrow: "up",
    targetHint: "Tabs are at the top-center of the map",
  },
  {
    icon: Bookmark,
    title: "Property Details",
    description:
      "Click any pin to view licence details, expiry dates, EPC certificate, max occupants, and compliance information.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    highlight: "center-left",
    arrow: "right",
    targetHint: "Details panel is now open on the right",
    showPropertyDetails: true,
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description:
      "Start managing your portfolio! Click any pin on the map to begin. Your credit balance is shown in the top bar.",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
]

// ---------------------------------------------------------------------------
// Agent steps (7)
// ---------------------------------------------------------------------------
const agentSteps: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description:
      "Your smart platform for sourcing HMO deals. Let's take a quick tour tailored to agents.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
  {
    icon: Filter,
    title: "Search & Filters",
    description:
      "Filters auto-default to purchase listings with a minimum deal score of 45. Adjust price range, property type, and use advanced filters to refine your search.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    highlight: "center-left",
    arrow: "left",
    targetHint: "The filter panel is on the left side",
  },
  {
    icon: MapPin,
    title: "Property Map",
    description:
      "The map shows all properties. Teal pins = Licensed HMOs, Green pins = Opportunities. Focus on green pins for the best sourcing deals.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Click any pin to view property details",
  },
  {
    icon: Target,
    title: "Deal Scoring & Comparison",
    description:
      "Every property has a deal score based on yield, price, and potential. Use the comparison tool to stack up to 3 properties side-by-side on yield, rent, and bedrooms.",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Look for the deal score badge on each property",
  },
  {
    icon: FileText,
    title: "Quick Filter Tabs",
    description:
      "Use the Opportunities tab for high-potential deals. Set a minimum deal score in the sidebar to only show properties above your threshold.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    highlight: "bottom-center",
    arrow: "up",
    targetHint: "Tabs are at the top-center of the map",
  },
  {
    icon: Bookmark,
    title: "Property Details",
    description:
      "Click any pin to see deal score, price, yield estimate, and owner contact data. Save properties and compare your top picks for clients.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    highlight: "center-left",
    arrow: "right",
    targetHint: "Details panel is now open on the right",
    showPropertyDetails: true,
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description:
      "Start sourcing deals! Click any pin on the map to begin. Your credit balance is shown in the top bar.",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
]

// ---------------------------------------------------------------------------
// Fallback steps — the original generic walkthrough for null/unknown roles
// ---------------------------------------------------------------------------
export const FALLBACK_STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to HMO Hunter",
    description:
      "Your smart platform for finding HMO investment opportunities. Let's take a quick tour to get you started.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
  {
    icon: Filter,
    title: "Search & Filters",
    description:
      "Use the left sidebar to search locations, set price ranges, and filter by property type. Your filters are saved automatically.",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    highlight: "center-left",
    arrow: "left",
    targetHint: "The filter panel is on the left side",
  },
  {
    icon: MapPin,
    title: "Property Map",
    description:
      "The map shows all properties. Teal pins = Licensed HMOs, Green pins = Opportunities, Red pins = Article 4 restricted areas.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    highlight: "center",
    arrow: "none",
    targetHint: "Click any pin to view property details",
  },
  {
    icon: FileText,
    title: "Quick Filter Tabs",
    description:
      "Use these tabs above the map to quickly filter: All, Licensed, Expired, Opportunities, or Restricted properties.",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    highlight: "bottom-center",
    arrow: "up",
    targetHint: "Tabs are at the top-center of the map",
  },
  {
    icon: Bookmark,
    title: "Property Details",
    description:
      "Click any property pin to open the details sidebar on the right. View pricing, yields, compliance info, and save properties.",
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    highlight: "center-left",
    arrow: "right",
    targetHint: "Details panel is now open on the right",
    showPropertyDetails: true,
  },
  {
    icon: Crown,
    title: "You're Ready!",
    description:
      "Start exploring! Click any pin on the map to begin. Your credit balance is shown in the top bar.",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    highlight: "center",
    arrow: "none",
    targetHint: "",
  },
]

// ---------------------------------------------------------------------------
// Role → steps mapping
// ---------------------------------------------------------------------------
export const ROLE_STEPS: Record<UserType, Step[]> = {
  investor: investorSteps,
  council_ta: councilTaSteps,
  operator: operatorSteps,
  agent: agentSteps,
}

/**
 * Returns the walkthrough steps for a given user role.
 * Falls back to the generic walkthrough for null/undefined/unknown roles.
 */
export function getStepsForRole(role: UserType | null | undefined): Step[] {
  if (!role || !(role in ROLE_STEPS)) {
    return FALLBACK_STEPS
  }
  return ROLE_STEPS[role]
}
