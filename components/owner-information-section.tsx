"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
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

// Log contact data access for GDPR compliance
async function logContactAccess(
  propertyId: string,
  contactName: string | undefined,
  dataType: string,
  accessType: "view" | "call" | "email" | "copy",
  contactCategory: "title_owner" | "licence_holder"
) {
  try {
    await fetch("/api/gdpr/log-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        ownerName: contactName,
        dataAccessed: [dataType, contactCategory],
        accessType,
      }),
    })
  } catch (error) {
    console.error("Failed to log access:", error)
  }
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

  // Title Owner data checks
  const hasTitleOwnerName = property.owner_name || property.company_name
  const hasTitleOwnerContact = property.owner_contact_email || property.owner_contact_phone
  const isCompany = property.owner_type === "company" || property.company_number

  // Licence Holder data checks
  const hasLicence = property.licensed_hmo || property.hmo_status?.includes("Licensed")
  const hasLicenceHolderName = property.licence_holder_name
  const hasLicenceHolderContact = property.licence_holder_email || property.licence_holder_phone

  // Check if title owner and licence holder are the same person/company
  const sameOwnerAndLicenceHolder =
    hasTitleOwnerName && hasLicenceHolderName &&
    (property.owner_name?.toLowerCase() === property.licence_holder_name?.toLowerCase() ||
     property.company_name?.toLowerCase() === property.licence_holder_name?.toLowerCase())

  return (
    <div className="space-y-4">
      {/* ============================================ */}
      {/* TITLE OWNER SECTION - Blue/Purple Theme */}
      {/* ============================================ */}
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-white" />
              <span className="text-white font-bold text-sm uppercase tracking-wide">Title Owner</span>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 text-xs">
              Land Registry
            </Badge>
          </div>
          <p className="text-blue-100 text-xs mt-1">Legal owner registered on property title</p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Owner Name/Company */}
          {hasTitleOwnerName ? (
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${isCompany ? "bg-purple-100" : "bg-blue-100"}`}>
                {isCompany ? (
                  <Building2 className="h-5 w-5 text-purple-600" />
                ) : (
                  <User className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {isCompany ? "Company" : "Individual"}
                </p>
                <p className="font-semibold text-gray-900">
                  {property.company_name || property.owner_name}
                </p>
                {property.owner_address && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {property.owner_address}
                  </p>
                )}
                {isCompany && property.company_number && (
                  <a
                    href={`https://find-and-update.company-information.service.gov.uk/company/${property.company_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    Co. #{property.company_number}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <User className="h-4 w-4" />
              <span className="text-sm">Owner name not available</span>
            </div>
          )}

          {/* Title Owner Contact Buttons */}
          {hasTitleOwnerContact ? (
            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-blue-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Contact Title Owner</p>
              <div className="flex flex-wrap gap-2">
                {property.owner_contact_phone && (
                  <a
                    href={`tel:${property.owner_contact_phone}`}
                    onClick={() => logContactAccess(property.id, property.owner_name, "phone", "call", "title_owner")}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{property.owner_contact_phone}</span>
                  </a>
                )}
                {property.owner_contact_email && (
                  <a
                    href={`mailto:${property.owner_contact_email}`}
                    onClick={() => logContactAccess(property.id, property.owner_name, "email", "email", "title_owner")}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-sm"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{property.owner_contact_email}</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-blue-200">
              {titleRequestSent ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Request sent! We'll find this contact.</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={() => handleInfoRequest("title_owner")}
                  disabled={titleRequestLoading}
                >
                  {titleRequestLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Request Title Owner Contact
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* LICENCE HOLDER SECTION - Teal/Green Theme */}
      {/* ============================================ */}
      <div className="rounded-xl overflow-hidden border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-white" />
              <span className="text-white font-bold text-sm uppercase tracking-wide">Licence Holder</span>
            </div>
            {hasLicence ? (
              <Badge className="bg-white/20 text-white border-white/30 text-xs">
                HMO Licensed
              </Badge>
            ) : (
              <Badge className="bg-amber-500/80 text-white border-amber-400 text-xs">
                Not Licensed
              </Badge>
            )}
          </div>
          <p className="text-teal-100 text-xs mt-1">Person/company responsible for HMO licence</p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {hasLicence ? (
            <>
              {/* Licence Holder Name */}
              {hasLicenceHolderName ? (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <Shield className="h-5 w-5 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Licence Holder</p>
                    <p className="font-semibold text-gray-900">{property.licence_holder_name}</p>
                    {property.licence_holder_address && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {property.licence_holder_address}
                      </p>
                    )}
                    {sameOwnerAndLicenceHolder && (
                      <Badge className="mt-2 bg-amber-100 text-amber-700 border-amber-300 text-xs">
                        Same as Title Owner
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Licence holder name not available</span>
                </div>
              )}

              {/* Licence Type & Term Box */}
              <div className="bg-gradient-to-r from-teal-100 to-emerald-100 rounded-lg p-3 space-y-3">
                {/* Licence Type */}
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-teal-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Licence Type</p>
                    <p className="font-semibold text-teal-800">
                      {property.licence_status === "active" ? "Mandatory HMO Licence" :
                       property.licence_status === "pending" ? "Pending HMO Licence" :
                       property.licence_status === "expired" ? "Expired HMO Licence" :
                       property.hmo_status || "HMO Licence"}
                    </p>
                  </div>
                </div>

                {/* Licence Term */}
                {(property.licence_start_date || property.licence_end_date) && (
                  <div className="flex items-start gap-2 pt-2 border-t border-teal-200/50">
                    <Calendar className="h-4 w-4 text-teal-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Existing Licence Term</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Start Date</p>
                          <p className="font-medium text-teal-800">
                            {property.licence_start_date
                              ? new Date(property.licence_start_date).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Not specified"}
                          </p>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">End Date</p>
                          <p className={`font-medium ${
                            property.licence_end_date && new Date(property.licence_end_date) < new Date()
                              ? "text-red-600"
                              : "text-teal-800"
                          }`}>
                            {property.licence_end_date
                              ? new Date(property.licence_end_date).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Not specified"}
                            {property.licence_end_date && new Date(property.licence_end_date) < new Date() && (
                              <span className="ml-1 text-xs">(Expired)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Details Row */}
                {(property.licence_id || property.max_occupants) && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-teal-200/50">
                    {property.licence_id && (
                      <div>
                        <p className="text-xs text-gray-500">Licence Number</p>
                        <p className="font-medium text-teal-700 text-sm">{property.licence_id}</p>
                      </div>
                    )}
                    {property.max_occupants && (
                      <div>
                        <p className="text-xs text-gray-500">Max Occupants</p>
                        <p className="font-medium text-teal-700 text-sm">{property.max_occupants} persons</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Licence Holder Contact Buttons */}
              {hasLicenceHolderContact ? (
                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-teal-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Contact Licence Holder</p>
                  <div className="flex flex-wrap gap-2">
                    {property.licence_holder_phone && (
                      <a
                        href={`tel:${property.licence_holder_phone}`}
                        onClick={() => logContactAccess(property.id, property.licence_holder_name, "phone", "call", "licence_holder")}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-semibold shadow-sm"
                      >
                        <Phone className="h-4 w-4" />
                        <span>{property.licence_holder_phone}</span>
                      </a>
                    )}
                    {property.licence_holder_email && (
                      <a
                        href={`mailto:${property.licence_holder_email}`}
                        onClick={() => logContactAccess(property.id, property.licence_holder_name, "email", "email", "licence_holder")}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold shadow-sm"
                      >
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{property.licence_holder_email}</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-teal-200">
                  {licenceRequestSent ? (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Request sent! We'll find this contact.</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-teal-300 text-teal-700 hover:bg-teal-100"
                      onClick={() => handleInfoRequest("licence_holder")}
                      disabled={licenceRequestLoading}
                    >
                      {licenceRequestLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Request Licence Holder Contact
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">This property is not currently HMO licensed.</p>
              <p className="text-gray-400 text-xs mt-1">Licence holder information only available for licensed HMOs.</p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* EXPANDABLE DETAILS SECTION */}
      {/* ============================================ */}
      {(isCompany || (property.directors && property.directors.length > 0)) && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg bg-white">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Company Details & Directors</span>
                {property.directors && property.directors.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {property.directors.length} directors
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
            <div className="space-y-4">
              {/* Company Info */}
              {isCompany && property.company_number && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-purple-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Company Number</p>
                    <a
                      href={`https://find-and-update.company-information.service.gov.uk/company/${property.company_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-purple-600 hover:underline flex items-center gap-1"
                    >
                      {property.company_number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {property.company_status && (
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <CompanyStatusBadge status={property.company_status} />
                    </div>
                  )}
                  {property.company_incorporation_date && (
                    <div>
                      <p className="text-xs text-gray-500">Incorporated</p>
                      <p className="text-sm font-medium">
                        {new Date(property.company_incorporation_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Directors */}
              {property.directors && property.directors.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Directors</p>
                  <div className="space-y-2">
                    {property.directors.map((director, idx) => (
                      <DirectorItem key={idx} director={director} />
                    ))}
                  </div>
                </div>
              )}

              {/* Data Source */}
              {property.owner_enrichment_source && (
                <p className="text-xs text-gray-400 pt-2 border-t">
                  Source: {property.owner_enrichment_source === "companies_house"
                    ? "Companies House"
                    : property.owner_enrichment_source === "searchland"
                    ? "Land Registry via Searchland"
                    : property.owner_enrichment_source}
                  {property.title_last_enriched_at && (
                    <span> · Updated {new Date(property.title_last_enriched_at).toLocaleDateString()}</span>
                  )}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Privacy Notice */}
      <div className="text-center">
        <Link
          href="/privacy"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Privacy & Data Protection
        </Link>
      </div>
    </div>
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
    <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
      <div>
        <span className="font-medium">{director.name}</span>
        {director.appointed_on && (
          <span className="text-gray-400 text-xs ml-2">
            since {new Date(director.appointed_on).toLocaleDateString("en-GB", {
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
      <Badge variant="outline" className="text-xs bg-gray-100">
        {director.role}
      </Badge>
    </div>
  )
}
