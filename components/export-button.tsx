"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

interface ExportButtonProps {
  propertyIds?: string[]
  filters?: Record<string, any>
  disabled?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function ExportButton({
  propertyIds,
  filters,
  disabled = false,
  variant = "outline",
  size = "sm"
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds, filters })
      })

      if (response.ok) {
        // Get the CSV content
        const blob = await response.blob()

        // Check for credit warning in headers
        const warning = response.headers.get('X-Credits-Warning')
        if (warning) {
          toast({
            title: "Credits Running Low",
            description: warning,
          })
        }

        // Create download link
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `hmo-hunter-export-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: "Export Complete",
          description: "Your CSV file has been downloaded",
        })
      } else {
        const data = await response.json()

        if (data.insufficientCredits) {
          toast({
            title: "Insufficient Credits",
            description: "CSV export costs 10 credits. You don't have enough credits.",
            variant: "destructive"
          })
        } else {
          toast({
            title: "Export Failed",
            description: data.error || "Failed to export properties",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Export Failed",
        description: "An error occurred during export",
        variant: "destructive"
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || exporting}
      className="gap-2"
    >
      <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  )
}
