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


/**
 * The walkthrough.
 *
 * Was four, keyed by user role. The roles are gone — the platform does one job
 * for one kind of user — so this is the sourcing walkthrough. FALLBACK_STEPS
 * remains for the demo tour, which runs without an account.
 */
export function getWalkthroughSteps(): Step[] {
  return investorSteps
}
