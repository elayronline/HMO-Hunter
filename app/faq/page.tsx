"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  Home,
  HelpCircle,
  Search,
  Shield,
  CreditCard,
  Map,
  FileText,
  Building,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  title: string
  icon: React.ReactNode
  items: FAQItem[]
}

const faqData: FAQCategory[] = [
  {
    title: "Getting Started",
    icon: <Home className="w-5 h-5" />,
    items: [
      {
        question: "What is HMO Hunter?",
        answer: "HMO Hunter is a property intelligence platform designed specifically for HMO (House in Multiple Occupation) investors in the UK. We aggregate data from HMO licensing registers, property listings, and public records to help you find licensed HMOs, identify investment opportunities, and research property ownership information."
      },
      {
        question: "How do I get started?",
        answer: "Simply create a free account to access the map and basic property information. You can browse licensed HMOs, filter by location, and save properties to your watchlist. Premium features like owner data, licence expiry filters, and potential HMO analysis require a Pro subscription."
      },
      {
        question: "Is HMO Hunter free to use?",
        answer: "Yes, basic features are free including browsing the map, viewing licensed HMO locations, and basic property details. Pro features include advanced filters, owner/contact data, licence expiry tracking, and potential HMO identification tools."
      },
      {
        question: "Which areas does HMO Hunter cover?",
        answer: "We currently cover major cities across England including Manchester, Birmingham, Leeds, Liverpool, Nottingham, Sheffield, Bristol, and London. We're continuously expanding our coverage as more councils publish their HMO register data."
      },
    ]
  },
  {
    title: "Property Data",
    icon: <Building className="w-5 h-5" />,
    items: [
      {
        question: "Where does the property data come from?",
        answer: "Our data is aggregated from multiple public sources including local council HMO registers, the Land Registry, EPC certificates, and property listing APIs. We cross-reference and validate data to ensure accuracy, but always recommend verifying critical information independently."
      },
      {
        question: "How often is the data updated?",
        answer: "We update our data regularly - HMO licence information is refreshed weekly, while property listings and market data are updated daily. The 'Last Updated' date shown on each property indicates when we last verified the information."
      },
      {
        question: "What does 'Licensed HMO' mean?",
        answer: "A Licensed HMO is a property that has been granted an HMO licence by the local council. This confirms the property meets safety and space standards for multiple occupancy. Mandatory licensing applies to properties with 5+ occupants from 2+ households, though some councils have Additional or Selective licensing schemes."
      },
      {
        question: "What is a 'Potential HMO'?",
        answer: "Potential HMOs are properties we've identified as suitable for HMO conversion based on factors like floor area, number of rooms, EPC rating, and location. These are not currently licensed HMOs but may represent investment opportunities. Pro subscribers can filter and analyse these properties."
      },
      {
        question: "Why do some properties show 'Expired Licence'?",
        answer: "Properties with expired licences had a valid HMO licence that has since lapsed. This could indicate the landlord chose not to renew, the property use changed, or it's simply awaiting renewal. These can represent opportunities to contact owners who may be looking to sell."
      },
    ]
  },
  {
    title: "Filters & Search",
    icon: <Search className="w-5 h-5" />,
    items: [
      {
        question: "What does the EPC Rating filter do?",
        answer: "The EPC (Energy Performance Certificate) filter lets you find properties meeting minimum energy efficiency standards. From April 2025, rental properties in England must have an EPC rating of C or above. Filtering by EPC helps identify compliant properties or value-add opportunities where an upgrade could increase value."
      },
      {
        question: "What are Article 4 areas?",
        answer: "Article 4 directions remove permitted development rights, meaning you need planning permission to convert a property to an HMO. Many councils have introduced Article 4 in areas with high HMO concentrations. Use the Article 4 filter to include, exclude, or only show properties in these restricted areas."
      },
      {
        question: "How does the Licence Type filter work?",
        answer: "Different councils issue different licence types: Mandatory (5+ occupants), Additional (3-4 occupants in some areas), or Selective (all private rentals in designated areas). Filtering by licence type helps you understand the regulatory environment and compliance requirements."
      },
      {
        question: "What is the Licence Expiry filter?",
        answer: "This Pro feature lets you find properties with licences expiring within a specific date range. Landlords with expiring licences may be motivated sellers, making this a powerful tool for sourcing off-market deals. You can filter by month range within a selected year."
      },
      {
        question: "How do I search by postcode?",
        answer: "In the location search, you can enter a postcode prefix (e.g., 'M14', 'B29', 'LS6') to filter properties in that area. This is useful for targeting specific neighbourhoods or streets you're interested in."
      },
    ]
  },
  {
    title: "Owner & Contact Data",
    icon: <FileText className="w-5 h-5" />,
    items: [
      {
        question: "Where does owner information come from?",
        answer: "Owner data is sourced from the Land Registry title register and cross-referenced with Companies House for corporate landlords. This is public information that we've aggregated to make property research more efficient. Contact details are sourced from HMO licence applications where publicly available."
      },
      {
        question: "Why can't I see owner data on some properties?",
        answer: "Owner data is a Pro feature. Additionally, some properties may not have owner information if: the title isn't registered with Land Registry, the owner has requested privacy, or we haven't yet enriched that specific property. We're continuously expanding our data coverage."
      },
      {
        question: "How do I contact a property owner?",
        answer: "For properties with contact data, you'll see phone and email options in the property details panel. We track contact attempts for your reference. Always be professional and compliant with data protection regulations when reaching out to property owners."
      },
      {
        question: "Is it legal to contact property owners directly?",
        answer: "Yes, contacting property owners using publicly available information is legal. However, you must comply with GDPR and privacy regulations. Don't send unsolicited marketing without consent, be honest about your intentions, and respect any opt-out requests immediately."
      },
    ]
  },
  {
    title: "Account & Subscription",
    icon: <CreditCard className="w-5 h-5" />,
    items: [
      {
        question: "What's included in the free plan?",
        answer: "Free accounts can browse the map, view licensed HMO locations, see basic property details (address, bedrooms, EPC rating, licence status), save properties to a watchlist, and use standard filters including EPC rating, Article 4 areas, broadband, and licence type. You get a limited number of detailed property views per day."
      },
      {
        question: "What additional features do Pro users get?",
        answer: "Pro subscribers unlock: (1) Owner & Contact Data - view title owner names, addresses, contact details, and company information for corporate landlords; (2) Licence Expiry Filter - find properties with licences expiring in specific month ranges to target motivated sellers; (3) Potential HMO Analysis - identify and filter unlicensed properties suitable for HMO conversion with classification, floor area, yield band, and deal score filters; (4) Premium Yield Calculator - advanced ROI calculations with customisable inputs; (5) Owner Data Filter - show only properties with verified ownership information."
      },
      {
        question: "How do credits work?",
        answer: "Some actions consume credits from your daily allowance, including viewing detailed property information and accessing owner data. Free users have a limited daily credit allowance that resets at midnight UTC. Pro users have significantly higher daily limits to support more intensive research."
      },
      {
        question: "How do I upgrade to Pro?",
        answer: "Click the 'Upgrade' button in the app or visit your account settings. Pro subscriptions are billed monthly and you can cancel anytime. Your Pro features remain active until the end of your billing period."
      },
      {
        question: "Can I cancel my subscription?",
        answer: "Yes, you can cancel your Pro subscription at any time from your account settings. You'll retain Pro access until the end of your current billing period. No refunds are provided for partial months."
      },
    ]
  },
  {
    title: "Map & Navigation",
    icon: <Map className="w-5 h-5" />,
    items: [
      {
        question: "What do the different pin colours mean?",
        answer: "Green pins indicate licensed HMOs with active licences. Orange pins show properties with expired licences. Purple pins (Pro only) highlight potential HMO opportunities. The pin colour helps you quickly identify property types across the map."
      },
      {
        question: "How do I see Article 4 boundaries on the map?",
        answer: "Toggle the 'Article 4 Overlay' option in the map legend to display Article 4 direction boundaries. Areas shaded in red/pink indicate where planning permission is required for HMO conversion."
      },
      {
        question: "Can I see multiple properties at once?",
        answer: "Yes, click on property clusters to zoom in and see individual pins. You can also use the property list view in the left panel to browse multiple properties and click to locate them on the map."
      },
      {
        question: "How do I save a property?",
        answer: "Click the heart icon on any property card or in the property details panel to save it to your watchlist. Access your saved properties anytime from the 'Saved' section in your account menu."
      },
    ]
  },
  {
    title: "HMO Regulations",
    icon: <Shield className="w-5 h-5" />,
    items: [
      {
        question: "What is mandatory HMO licensing?",
        answer: "Since October 2018, all HMOs in England with 5 or more occupants forming 2 or more households require a mandatory licence. This applies regardless of the number of storeys. Penalties for operating without a licence can be up to £30,000 per offence."
      },
      {
        question: "What are Additional and Selective licensing?",
        answer: "Some councils introduce Additional licensing (covering smaller HMOs not caught by mandatory rules) or Selective licensing (covering all private rented properties in designated areas). Check your target council's website to understand local requirements."
      },
      {
        question: "What are HMO space standards?",
        answer: "Minimum room sizes for HMOs are: 6.51m² for one person, 10.22m² for two people. Shared kitchens and bathrooms must meet specific standards based on occupant numbers. These requirements are checked during the licensing process."
      },
      {
        question: "Do I need planning permission for an HMO?",
        answer: "Converting a dwelling (C3 use class) to a small HMO (C4, 3-6 occupants) is usually permitted development - no planning needed. However, if the property is in an Article 4 area, or you're creating a large HMO (7+ occupants, Sui Generis), you'll need planning permission."
      },
      {
        question: "What happens if I buy a property with an expired licence?",
        answer: "HMO licences don't automatically transfer to new owners. If you buy a licensed HMO, you'll need to apply for a new licence in your name. If the licence has expired, you should apply before continuing to let the property as an HMO to avoid penalties."
      },
    ]
  },
]

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-left hover:text-teal-600 transition-colors"
      >
        <span className="font-medium text-slate-900 pr-4">{item.question}</span>
        <ChevronDown className={cn(
          "w-5 h-5 text-slate-400 transition-transform flex-shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 pb-4" : "max-h-0"
      )}>
        <p className="text-slate-600 leading-relaxed">{item.answer}</p>
      </div>
    </div>
  )
}

function FAQCategory({ category, openItems, toggleItem }: {
  category: FAQCategory
  openItems: Set<string>
  toggleItem: (id: string) => void
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
          {category.icon}
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{category.title}</h2>
      </div>
      <div>
        {category.items.map((item, index) => {
          const itemId = `${category.title}-${index}`
          return (
            <FAQAccordionItem
              key={itemId}
              item={item}
              isOpen={openItems.has(itemId)}
              onToggle={() => toggleItem(itemId)}
            />
          )
        })}
      </div>
    </Card>
  )
}

export default function FAQPage() {
  const router = useRouter()
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-teal-600" />
                Frequently Asked Questions
              </h1>
              <p className="text-sm text-slate-500">Find answers to common questions about HMO Hunter</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Map
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Quick Links */}
        <div className="mb-8">
          <p className="text-sm text-slate-600 mb-3">Jump to section:</p>
          <div className="flex flex-wrap gap-2">
            {faqData.map((category) => (
              <a
                key={category.title}
                href={`#${category.title.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:text-teal-600 hover:border-teal-200 transition-colors"
              >
                {category.icon}
                {category.title}
              </a>
            ))}
          </div>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-6">
          {faqData.map((category) => (
            <div key={category.title} id={category.title.toLowerCase().replace(/\s+/g, '-')}>
              <FAQCategory
                category={category}
                openItems={openItems}
                toggleItem={toggleItem}
              />
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <Card className="mt-8 p-6 bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-100">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Still have questions?</h3>
            <p className="text-slate-600 mb-4">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => window.location.href = 'mailto:support@hmohunter.co.uk'}
            >
              Contact Support
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
