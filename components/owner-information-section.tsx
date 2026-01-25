"use client"

import { useState } from "react"
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  User,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { Director, Property } from "@/lib/types/database"

interface OwnerInformationSectionProps {
  property: Property
  defaultOpen?: boolean
}

export function OwnerInformationSection({
  property,
  defaultOpen = false,
}: OwnerInformationSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [titleRequestSent, setTitleRequestSent] = useState(false)
  const [titleRequestLoading, setTitleRequestLoading] = useState(false)
  const [licenceRequestSent, setLicenceRequestSent] = useState(false)
  const [licenceRequestLoading, setLicenceRequestLoading] = useState(false)

  const handleInfoRequest = async (requestType: "title_owner" | "licence_holder") => {
    const setLoading = requestType === "title_owner" ? setTitleRequestLoading : setLicenceRequestLoading
    const setSent = requestType === "title_owner" ? setTitleRequestSent : setLicenceRequestSent

    setLoading(true)
    try {
      const response = await fetch("/api/info-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          propertyAddress: property.address,
          postcode: property.postcode,
          city: property.city,
          requestType,
        }),
      })

      if (response.ok) {
        setSent(true)
      }
    } catch (error) {
      console.error("Failed to send info request:", error)
    } finally {
      setLoading(false)
    }
  }

  const hasTitleOwnerData =
    property.owner_name ||
    property.company_name ||
    property.company_number

  // Check for licence holder data (from HMO status or licence fields)
  const hasLicenceData = property.licensed_hmo || property.hmo_status?.includes("Licensed")

  const isCompany = property.owner_type === "company" || property.company_number

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Title Owner & Licence Holder</span>
            {hasTitleOwnerData ? (
              <OwnerTypeBadge type={property.owner_type} />
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                Data Available
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-6">
          {/* TITLE OWNER SECTION */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              {isCompany ? (
                <Building2 className="h-4 w-4 text-purple-600" />
              ) : (
                <User className="h-4 w-4 text-blue-600" />
              )}
              <span className="font-semibold text-sm">Title Owner (Freeholder/Leaseholder)</span>
            </div>

            {hasTitleOwnerData ? (
              <div className="space-y-3">
                {/* Owner/Company Name */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {isCompany ? "Company Name" : "Owner Name"}
                  </p>
                  <p className="font-medium text-sm">
                    {property.company_name || property.owner_name || "N/A"}
                  </p>
                </div>

                {/* Company Number & Status */}
                {isCompany && property.company_number && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Company Number</p>
                      <a
                        href={`https://find-and-update.company-information.service.gov.uk/company/${property.company_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {property.company_number}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {property.company_status && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <CompanyStatusBadge status={property.company_status} />
                      </div>
                    )}
                  </div>
                )}

                {/* Incorporation Date */}
                {property.company_incorporation_date && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Incorporated</p>
                    <p className="text-sm">
                      {new Date(property.company_incorporation_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}

                {/* Registered Address */}
                {property.owner_address && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {isCompany ? "Registered Office" : "Address"}
                    </p>
                    <p className="text-sm">{property.owner_address}</p>
                  </div>
                )}

                {/* Directors */}
                {isCompany && property.directors && property.directors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Directors ({property.directors.length})
                    </p>
                    <div className="space-y-1">
                      {property.directors.slice(0, 5).map((director, idx) => (
                        <DirectorItem key={idx} director={director} />
                      ))}
                      {property.directors.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{property.directors.length - 5} more directors
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Buttons */}
                {(property.owner_contact_email || property.owner_contact_phone) && (
                  <div className="flex gap-2 pt-2">
                    {property.owner_contact_email && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={`mailto:${property.owner_contact_email}`}>
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </a>
                      </Button>
                    )}
                    {property.owner_contact_phone && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={`tel:${property.owner_contact_phone}`}>
                          <Phone className="h-4 w-4 mr-1" />
                          Call
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {/* Data Source */}
                {property.owner_enrichment_source && (
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Source: {property.owner_enrichment_source === "companies_house"
                      ? "Companies House"
                      : property.owner_enrichment_source === "searchland"
                      ? "Land Registry via Searchland"
                      : property.owner_enrichment_source}
                    {property.title_last_enriched_at && (
                      <span> (Updated {new Date(property.title_last_enriched_at).toLocaleDateString()})</span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-700">N/A</p>
                {titleRequestSent ? (
                  <div className="flex items-center gap-1 mt-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs">Request sent! We'll look into this.</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => handleInfoRequest("title_owner")}
                    disabled={titleRequestLoading}
                  >
                    {titleRequestLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3 mr-1" />
                        I want this info
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* LICENCE HOLDER SECTION */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <Shield className="h-4 w-4 text-teal-600" />
              <span className="font-semibold text-sm">HMO Licence Holder</span>
              {hasLicenceData && (
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300">
                  Licensed
                </Badge>
              )}
            </div>

            {hasLicenceData ? (
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                <p className="text-sm font-medium text-teal-800">
                  {property.hmo_status || "Licensed HMO"}
                </p>
                {licenceRequestSent ? (
                  <div className="flex items-center gap-1 mt-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs">Request sent! We'll look into this.</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs bg-white"
                    onClick={() => handleInfoRequest("licence_holder")}
                    disabled={licenceRequestLoading}
                  >
                    {licenceRequestLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3 mr-1" />
                        I want contact info
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-700">N/A</p>
                {licenceRequestSent ? (
                  <div className="flex items-center gap-1 mt-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs">Request sent! We'll look into this.</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => handleInfoRequest("licence_holder")}
                    disabled={licenceRequestLoading}
                  >
                    {licenceRequestLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3 mr-1" />
                        I want this info
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function OwnerTypeBadge({ type }: { type: Property["owner_type"] }) {
  const config: Record<string, { label: string; className: string }> = {
    individual: {
      label: "Individual",
      className: "bg-blue-50 text-blue-700 border-blue-300",
    },
    company: {
      label: "Company",
      className: "bg-purple-50 text-purple-700 border-purple-300",
    },
    trust: {
      label: "Trust",
      className: "bg-amber-50 text-amber-700 border-amber-300",
    },
    government: {
      label: "Government",
      className: "bg-green-50 text-green-700 border-green-300",
    },
    unknown: {
      label: "Unknown",
      className: "bg-gray-50 text-gray-600 border-gray-300",
    },
  }

  const { label, className } = config[type || "unknown"] || config.unknown

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}

function CompanyStatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === "active"

  return (
    <Badge
      variant="outline"
      className={
        isActive
          ? "bg-green-50 text-green-700 border-green-300"
          : "bg-red-50 text-red-700 border-red-300"
      }
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function DirectorItem({ director }: { director: Director }) {
  return (
    <div className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
      <span>{director.name}</span>
      <span className="text-muted-foreground text-xs">{director.role}</span>
    </div>
  )
}

