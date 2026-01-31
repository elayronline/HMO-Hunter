"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ArrowLeft,
  MapPin,
  Search,
  Bookmark,
  Crown,
  User,
  Shield,
  HelpCircle,
  Mail
} from "lucide-react"

const faqCategories = [
  {
    title: "Getting Started",
    icon: HelpCircle,
    questions: [
      {
        q: "What is HMO Hunter?",
        a: "HMO Hunter is a property investment platform that helps you find Houses in Multiple Occupation (HMO) investment opportunities. We aggregate property listings and HMO licence data to help investors identify potential opportunities."
      },
      {
        q: "How do I create an account?",
        a: "Click 'Sign up' on the login page, enter your email and password, then verify your email address. Once verified, you can start exploring properties immediately."
      },
      {
        q: "Is there a mobile app?",
        a: "HMO Hunter is a web application optimized for both desktop and mobile browsers. Simply visit our website on any device to access all features."
      },
    ]
  },
  {
    title: "Map & Search",
    icon: MapPin,
    questions: [
      {
        q: "How do I search for properties?",
        a: "Use the search bar at the top to search by postcode or area name. You can also browse the map directly - zoom in on areas you're interested in and click on property pins to see details."
      },
      {
        q: "What do the different pin colors mean?",
        a: "Green pins indicate licensed HMOs with active licences. Blue pins show potential HMO opportunities. Orange pins may indicate properties in Article 4 restricted areas. Click the legend on the map for the full color guide."
      },
      {
        q: "How do I filter properties?",
        a: "Use the category tabs above the map (All, Licensed, Opportunities, etc.) to filter properties by type. You can also use the sidebar filters to narrow by price, bedrooms, and yield."
      },
      {
        q: "Can I search multiple areas at once?",
        a: "Currently, the map displays properties in the selected city/area. Use the city selector or search bar to switch between different locations."
      },
    ]
  },
  {
    title: "Properties",
    icon: Search,
    questions: [
      {
        q: "Where does the property data come from?",
        a: "We aggregate data from multiple verified sources including property listings and official council records. Data is regularly updated to ensure accuracy."
      },
      {
        q: "What is a 'Potential HMO'?",
        a: "A Potential HMO is a property that meets typical HMO criteria (usually 3+ bedrooms) but doesn't currently have an HMO licence. These may represent conversion opportunities."
      },
      {
        q: "How is the yield calculated?",
        a: "Estimated yield is calculated using comparable room rental rates in the area, multiplied by the number of lettable rooms, divided by the property price. This is an estimate - always do your own due diligence."
      },
      {
        q: "What does Article 4 mean?",
        a: "Article 4 directions are planning restrictions that require planning permission to convert a property to an HMO. Properties in Article 4 areas need additional approval before HMO conversion."
      },
    ]
  },
  {
    title: "Saving & Tracking",
    icon: Bookmark,
    questions: [
      {
        q: "How do I save a property?",
        a: "Click the bookmark icon on any property card to save it. Access your saved properties anytime from the 'Saved' page in the navigation menu."
      },
      {
        q: "Is there a limit to saved properties?",
        a: "There's no limit - save as many properties as you like. You can remove saved properties at any time by clicking the bookmark icon again."
      },
      {
        q: "Can I add notes to saved properties?",
        a: "Notes feature is coming soon. For now, you can track properties by saving them and viewing them on the Saved page."
      },
    ]
  },
  {
    title: "Premium Features",
    icon: Crown,
    questions: [
      {
        q: "What's included in Premium?",
        a: "Premium users get access to owner information including company details, directors, and contact information where available. Premium also includes advanced analytics and priority data updates."
      },
      {
        q: "How do I upgrade to Premium?",
        a: "Contact our team to discuss Premium access. We're currently in beta and offering early-adopter pricing for qualified investors."
      },
      {
        q: "Can I try Premium before subscribing?",
        a: "Beta testers have access to Premium features during the testing period. Contact us to join the beta program."
      },
    ]
  },
  {
    title: "Account & Privacy",
    icon: User,
    questions: [
      {
        q: "How do I reset my password?",
        a: "Click 'Forgot password?' on the login page, enter your email, and we'll send you a reset link. Click the link in the email to set a new password."
      },
      {
        q: "How is my data protected?",
        a: "We take data protection seriously. Your personal data is encrypted and stored securely. We never share your information with third parties without consent. See our Privacy Policy for full details."
      },
      {
        q: "How do I delete my account?",
        a: "To delete your account and all associated data, visit the Data Request page or contact us directly. We'll process your request in accordance with GDPR requirements."
      },
      {
        q: "Can I export my saved properties?",
        a: "Export functionality is coming soon. Contact us if you need to export your data for any reason."
      },
    ]
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Map
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <img
              src="/hmo-hunter-logo.png"
              alt="HMO Hunter"
              className="h-8 w-auto"
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
            <HelpCircle className="h-8 w-8 text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Help Center</h1>
          <p className="text-slate-600">
            Find answers to common questions about using HMO Hunter
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-6">
          {faqCategories.map((category) => {
            const Icon = category.icon
            return (
              <Card key={category.title} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {category.title}
                  </h2>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, index) => (
                    <AccordionItem
                      key={index}
                      value={`${category.title}-${index}`}
                      className="border-slate-200"
                    >
                      <AccordionTrigger className="text-left text-sm font-medium text-slate-800 hover:text-teal-600">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            )
          })}
        </div>

        {/* Contact section */}
        <Card className="p-6 mt-8 bg-gradient-to-br from-teal-50 to-slate-50">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 rounded-full mb-4">
              <Mail className="h-6 w-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Still need help?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Can't find what you're looking for? Our team is here to help.
            </p>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Mail className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </Card>

        {/* Quick links */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/privacy" className="text-slate-500 hover:text-teal-600">
            Privacy Policy
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/data-request" className="text-slate-500 hover:text-teal-600">
            Data Request
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/" className="text-slate-500 hover:text-teal-600">
            Back to App
          </Link>
        </div>
      </main>
    </div>
  )
}
