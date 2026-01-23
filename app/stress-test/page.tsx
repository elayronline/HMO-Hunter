import { runStressTest, runAPIStressTest, runHealthCheck, runCityDataTest } from "@/app/actions/stress-test"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle, Clock, Database, Zap, Server, Globe, ArrowRight, MapPin } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function StressTestPage() {
  const [systemResults, apiResults, healthCheck, cityDataResults] = await Promise.all([
    runStressTest(),
    runAPIStressTest(),
    runHealthCheck(),
    runCityDataTest(),
  ])

  const allPassed = systemResults.failed === 0 && apiResults.failed === 0 && cityDataResults.citiesWithoutData === 0

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Production Stress Test</h1>
            <p className="text-muted-foreground">
              System diagnostics, API testing, and UK city data coverage
            </p>
          </div>
          <Link href="/">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              Back to Home <ArrowRight className="ml-1 h-3 w-3" />
            </Badge>
          </Link>
        </div>

        {/* Overall Status Banner */}
        <Card className={allPassed ? "border-green-500 bg-green-500/5" : "border-amber-500 bg-amber-500/5"}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {allPassed ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                )}
                <div>
                  <p className="text-lg font-semibold">
                    {allPassed ? "All Systems Operational" : "Some Tests Need Attention"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {systemResults.passed + apiResults.successful + cityDataResults.citiesWithData} passed, {systemResults.failed + apiResults.failed + cityDataResults.citiesWithoutData} failed
                  </p>
                </div>
              </div>
              <Badge variant={allPassed ? "default" : "secondary"} className="text-sm">
                {allPassed ? "Production Ready" : "Review Required"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* City Data Coverage - NEW SECTION */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  UK City Data Coverage
                </CardTitle>
                <CardDescription>
                  Property data availability across all {cityDataResults.totalCities} supported UK cities
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  {cityDataResults.citiesWithData} With Data
                </Badge>
                {cityDataResults.citiesWithoutData > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600">
                    {cityDataResults.citiesWithoutData} Missing
                  </Badge>
                )}
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                  {cityDataResults.totalProperties} Properties
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Region Summary */}
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              {["England", "Scotland", "Wales", "Northern Ireland"].map((region) => {
                const regionCities = cityDataResults.results.filter((r) => r.region === region)
                const withData = regionCities.filter((r) => r.propertyCount > 0).length
                const totalProps = regionCities.reduce((sum, r) => sum + r.propertyCount, 0)
                return (
                  <div key={region} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{region}</span>
                      <Badge variant={withData === regionCities.length ? "default" : "secondary"} className="text-xs">
                        {withData}/{regionCities.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{totalProps} properties</p>
                  </div>
                )
              })}
            </div>

            {/* City Grid */}
            <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-5">
              {cityDataResults.results.map((result) => (
                <div
                  key={result.city}
                  className={`flex items-center justify-between rounded-lg border p-2 text-sm ${
                    result.status === "pass"
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.status === "pass" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{result.city}</span>
                  </div>
                  <Badge variant="outline" className="text-xs ml-1">
                    {result.propertyCount}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">
                Query Duration: {cityDataResults.totalDuration}ms
              </span>
              <span className="text-xs text-muted-foreground">{cityDataResults.timestamp}</span>
            </div>
          </CardContent>
        </Card>

        {/* Health Check Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Health
              </CardTitle>
              <Badge variant={healthCheck.healthy ? "default" : "destructive"}>
                {healthCheck.healthy ? "Healthy" : "Unhealthy"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Database className={`h-5 w-5 ${healthCheck.database ? "text-green-500" : "text-red-500"}`} />
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">
                    {healthCheck.database ? "Connected" : "Error"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Zap className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">API Adapters</p>
                  <p className="text-xs text-muted-foreground">
                    {healthCheck.apiAdapters}/3 configured
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Globe className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">Active APIs</p>
                  <p className="text-xs text-muted-foreground">
                    {healthCheck.configuredApis?.join(", ") || "None"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Test Time</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{healthCheck.message}</p>
          </CardContent>
        </Card>

        {/* Live API Tests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Live API Tests
                </CardTitle>
                <CardDescription>
                  Real-time connectivity tests to external APIs
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  {apiResults.successful} Connected
                </Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-600">
                  {apiResults.failed} Failed
                </Badge>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                  {apiResults.skipped} Skipped
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {apiResults.results.map((result, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    result.status === "success"
                      ? "border-green-500/30 bg-green-500/5"
                      : result.status === "error"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-yellow-500/30 bg-yellow-500/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.status === "success" && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                    {result.status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
                    {result.status === "skipped" && <AlertCircle className="h-6 w-6 text-yellow-500" />}
                    <div>
                      <p className="font-semibold">{result.api}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {result.endpoint}
                      </p>
                      {result.error && (
                        <p className="text-xs text-red-500 mt-1 max-w-md truncate">
                          {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {result.statusCode && (
                      <Badge variant="outline" className={result.statusCode < 400 ? "text-green-600" : "text-red-600"}>
                        HTTP {result.statusCode}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {result.responseTime}ms
                    </span>
                    <Badge
                      variant={
                        result.status === "success" ? "default" : result.status === "error" ? "destructive" : "secondary"
                      }
                    >
                      {result.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">
                Total Duration: {apiResults.totalDuration}ms
              </span>
              <span className="text-xs text-muted-foreground">{apiResults.timestamp}</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Quick actions based on test results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/live-dashboard" className="block">
                <div className="rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer">
                  <h3 className="font-semibold mb-1">Live Dashboard</h3>
                  <p className="text-sm text-muted-foreground">View real-time property insights from APIs</p>
                </div>
              </Link>
              <Link href="/admin" className="block">
                <div className="rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer">
                  <h3 className="font-semibold mb-1">Admin Panel</h3>
                  <p className="text-sm text-muted-foreground">Run ingestion and manage data sources</p>
                </div>
              </Link>
              <Link href="/" className="block">
                <div className="rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer">
                  <h3 className="font-semibold mb-1">Main App</h3>
                  <p className="text-sm text-muted-foreground">View properties and search listings</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Raw Output */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Test Output</CardTitle>
            <CardDescription>Complete JSON for debugging</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify({ systemResults, apiResults, healthCheck, cityDataResults }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
