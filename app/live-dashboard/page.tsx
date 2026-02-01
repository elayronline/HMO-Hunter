import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, TrendingUp, Home, Shield } from "lucide-react"
import { supabaseAdmin } from "@/lib/supabase-admin"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function LiveDashboard() {
  // Fetch stats directly from database
  const { count: totalCount } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_stale", false)

  const { count: purchaseCount } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_stale", false)
    .eq("listing_type", "purchase")

  const { count: rentCount } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_stale", false)
    .eq("listing_type", "rent")

  const { count: licensedCount } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_stale", false)
    .eq("licensed_hmo", true)

  const { count: withEpcCount } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_stale", false)
    .not("epc_rating", "is", null)

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Property Insights Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Real-time property data and market insights
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Badge variant="outline" className="text-teal-600 border-teal-600">
              <Building2 className="w-4 h-4 mr-1" />
              {totalCount} Properties
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-600" />
                <span className="text-2xl font-bold">{totalCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-700">{purchaseCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600">Rent-to-Rent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-700">{rentCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-teal-600">Licensed HMOs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-500" />
                <span className="text-2xl font-bold text-teal-700">{licensedCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">With EPC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-700">{withEpcCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalCount ? Math.round((withEpcCount || 0) / totalCount * 100) : 0}% coverage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              Data Overview
            </CardTitle>
            <CardDescription>
              Property data is automatically enriched with valuations, market analytics, and HMO licensing information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground text-center mb-4">
                Browse the main property map to explore all available listings with enriched data.
              </p>
              <Link href="/">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <MapPin className="w-4 h-4 mr-2" />
                  Browse Properties
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
