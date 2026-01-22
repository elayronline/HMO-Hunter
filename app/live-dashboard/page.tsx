import { ingestLiveProperties } from "@/app/actions/ingest-live-properties"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Building2, MapPin, RefreshCw } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function LiveDashboard() {
  const response = await ingestLiveProperties()
  const results = response.results

  const successCount = response.successful
  const failedCount = response.failed

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Live Property Insights Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Real-time data from PropertyData, StreetData, and PaTMa APIs
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              <RefreshCw className="w-4 h-4 mr-1" />
              {response.totalProcessed} Processed
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              {successCount} Success
            </Badge>
            <Badge variant="outline" className="text-red-600 border-red-600">
              <XCircle className="w-4 h-4 mr-1" />
              {failedCount} Failed
            </Badge>
          </div>
        </div>

        <div className="grid gap-4">
          {results.map((r, i) => (
            <Card key={i} className={r.status === "success" ? "border-green-200" : "border-red-200"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    <span className="font-mono">{r.property.postcode}</span>
                    {r.property.uprn && (
                      <span className="text-sm text-muted-foreground font-normal">
                        UPRN: {r.property.uprn}
                      </span>
                    )}
                  </CardTitle>
                  <Badge variant={r.status === "success" ? "default" : "destructive"}>
                    {r.status === "success" ? "Ingested" : "Failed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {r.status === "success" && r.insights ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Data Completeness</p>
                        <p className="text-xl font-bold">
                          {Math.round((r.insights.summary?.dataCompleteness || 0) * 100)}%
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Sources</p>
                        <p className="text-xl font-bold">
                          {r.insights.summary?.sourcesUsed?.length || 0}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Estimated Value</p>
                        <p className="text-xl font-bold">
                          {r.insights.streetData?.valuation?.estimatedValue
                            ? `£${r.insights.streetData.valuation.estimatedValue.toLocaleString()}`
                            : "N/A"}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Yield</p>
                        <p className="text-xl font-bold">
                          {r.insights.patma?.yieldAnalysis?.grossYield
                            ? `${r.insights.patma.yieldAnalysis.grossYield}%`
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Raw Data Accordion */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        View Raw API Response
                      </summary>
                      <pre className="mt-2 bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(r.insights, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span>Error: {r.error || "Unknown error occurred"}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {results.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No properties ingested yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
