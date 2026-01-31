import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { apiConfig } from "@/lib/config/api-config"
import { requireAdmin } from "@/lib/api-auth"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  // Require admin access for stress testing
  const auth = await requireAdmin()
  if (!auth.authenticated) {
    return auth.response
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check API configurations
  const apiStatus = {
    searchland: {
      configured: apiConfig.searchland.enabled && !!apiConfig.searchland.apiKey,
      keyPrefix: apiConfig.searchland.apiKey?.substring(0, 8) || "not set",
    },
    companiesHouse: {
      configured: apiConfig.companiesHouse.enabled && !!apiConfig.companiesHouse.apiKey,
      keyPrefix: apiConfig.companiesHouse.apiKey?.substring(0, 8) || "not set",
    },
  }

  // Get counts for different owner data scenarios
  const { count: totalProperties } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")

  // Properties with any owner name
  const { count: withOwnerName } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("owner_name", "is", null)

  // Properties with company info
  const { count: withCompanyName } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_name", "is", null)

  const { count: withCompanyNumber } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_number", "is", null)

  // Properties with title number (Land Registry)
  const { count: withTitleNumber } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("title_number", "is", null)

  // Properties with contact details
  const { count: withOwnerEmail } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("owner_contact_email", "is", null)

  const { count: withOwnerPhone } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("owner_contact_phone", "is", null)

  // Properties with licence holder info
  const { count: withLicenceHolder } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("licence_holder_name", "is", null)

  // Properties with directors (company owners)
  const { count: withDirectors } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("directors", "is", null)

  // Properties with agent contact info (for purchase listings)
  const { count: withAgentName } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("agent_name", "is", null)

  const { count: withAgentPhone } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("agent_phone", "is", null)

  const { count: withAgentEmail } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("agent_email", "is", null)

  // Purchase properties with agent contact
  const { count: purchaseTotal } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .eq("listing_type", "purchase")

  const { count: purchaseWithAgent } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .eq("listing_type", "purchase")
    .or("agent_name.not.is.null,agent_phone.not.is.null")

  // Sample properties with owner data
  const { data: sampleWithOwners } = await supabase
    .from("properties")
    .select(`
      id, address, city, postcode,
      owner_name, owner_address, owner_type,
      owner_contact_email, owner_contact_phone,
      company_name, company_number, company_status,
      directors,
      title_number, title_last_enriched_at,
      licence_holder_name, licence_holder_email, licence_holder_phone,
      licensed_hmo, is_potential_hmo,
      external_id
    `)
    .or("is_stale.eq.false,is_stale.is.null")
    .not("owner_name", "is", null)
    .limit(20)

  // Sample properties with company owners
  const { data: sampleCompanyOwners } = await supabase
    .from("properties")
    .select(`
      id, address, city,
      company_name, company_number, company_status,
      directors,
      owner_contact_email, owner_contact_phone
    `)
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_name", "is", null)
    .limit(10)

  // Check for data quality issues
  const { data: missingData } = await supabase
    .from("properties")
    .select("id, address, owner_name, company_name, company_number")
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_name", "is", null)
    .is("company_number", null)
    .limit(10)

  // Properties with title but no owner
  const { data: titleNoOwner } = await supabase
    .from("properties")
    .select("id, address, title_number")
    .or("is_stale.eq.false,is_stale.is.null")
    .not("title_number", "is", null)
    .is("owner_name", null)
    .is("company_name", null)
    .limit(10)

  // Properties needing Companies House enrichment (have company_number but no directors)
  const { count: needsCompaniesHouse } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_number", "is", null)
    .is("directors", null)

  // Properties needing Searchland enrichment (no title_number yet)
  const { count: needsSearchland } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .is("title_number", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  // Calculate coverage percentages
  const ownerCoverage = totalProperties ? ((withOwnerName || 0) / totalProperties * 100).toFixed(1) : "0"
  const companyCoverage = withCompanyNumber ? ((withDirectors || 0) / withCompanyNumber * 100).toFixed(1) : "N/A"
  const titleCoverage = totalProperties ? ((withTitleNumber || 0) / totalProperties * 100).toFixed(1) : "0"

  return NextResponse.json({
    apiConfiguration: apiStatus,
    summary: {
      totalProperties,
      withAnyOwnerData: withOwnerName! + withCompanyName!,
      ownerDataBreakdown: {
        withOwnerName,
        withCompanyName,
        withCompanyNumber,
        withTitleNumber,
        withDirectors,
      },
      contactData: {
        withOwnerEmail,
        withOwnerPhone,
        withLicenceHolder,
      },
      agentData: {
        withAgentName,
        withAgentPhone,
        withAgentEmail,
        purchaseListings: {
          total: purchaseTotal,
          withAgentContact: purchaseWithAgent,
          coverage: purchaseTotal ? `${((purchaseWithAgent || 0) / purchaseTotal * 100).toFixed(1)}%` : "N/A",
        },
      },
    },
    dataQualityIssues: {
      companyWithoutNumber: missingData?.length || 0,
      titleWithoutOwner: titleNoOwner?.length || 0,
      samples: {
        companyMissingNumber: missingData?.slice(0, 5).map(p => ({
          address: p.address?.slice(0, 40),
          company: p.company_name,
        })),
        titleNoOwner: titleNoOwner?.slice(0, 5).map(p => ({
          address: p.address?.slice(0, 40),
          title: p.title_number,
        })),
      },
    },
    sampleOwnerData: sampleWithOwners?.slice(0, 10).map(p => ({
      address: p.address?.slice(0, 40),
      city: p.city,
      ownerName: p.owner_name,
      ownerType: p.owner_type,
      ownerAddress: p.owner_address?.slice(0, 50),
      email: p.owner_contact_email ? "✓" : null,
      phone: p.owner_contact_phone ? "✓" : null,
      titleNumber: p.title_number,
      enrichedAt: p.title_last_enriched_at,
      licenceHolder: p.licence_holder_name,
      isLicensed: p.licensed_hmo,
      isPotentialHmo: p.is_potential_hmo,
      source: p.external_id?.split("-")[0],
    })),
    sampleCompanyOwners: sampleCompanyOwners?.map(p => ({
      address: p.address?.slice(0, 40),
      city: p.city,
      companyName: p.company_name,
      companyNumber: p.company_number,
      companyStatus: p.company_status,
      directorsCount: p.directors?.length || 0,
      directors: p.directors?.slice(0, 3).map((d: any) => d.name),
      hasContact: !!(p.owner_contact_email || p.owner_contact_phone),
    })),
    enrichmentGaps: {
      needsSearchlandEnrichment: needsSearchland,
      needsCompaniesHouseEnrichment: needsCompaniesHouse,
      coveragePercentages: {
        ownerData: `${ownerCoverage}%`,
        titleData: `${titleCoverage}%`,
        directorData: `${companyCoverage}%`,
      },
    },
    recommendations: [
      ...(needsSearchland && needsSearchland > 0 ? [`Run Searchland enrichment: POST /api/enrich-owner with { limit: ${Math.min(needsSearchland, 50)} }`] : []),
      ...(needsCompaniesHouse && needsCompaniesHouse > 0 ? [`Run Companies House enrichment: POST /api/enrich-companies with { limit: ${Math.min(needsCompaniesHouse, 50)} }`] : []),
      ...(!apiStatus.searchland.configured ? ["Configure Searchland API: Add SEARCHLAND_API_KEY to .env.local"] : []),
      ...(!apiStatus.companiesHouse.configured ? ["Configure Companies House API: Add COMPANIES_HOUSE_API_KEY to .env.local"] : []),
    ],
    enrichmentEndpoints: {
      searchland: {
        test: "POST /api/enrich-owner with { testOnly: true }",
        enrichBatch: "POST /api/enrich-owner with { limit: 10 }",
      },
      companiesHouse: {
        status: "GET /api/enrich-companies",
        enrichBatch: "POST /api/enrich-companies with { limit: 10 }",
      },
    },
  })
}
