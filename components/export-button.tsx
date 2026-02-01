"use client"

import { useState } from "react"
import { Download, Lock, FileText, FileSpreadsheet, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

interface ExportButtonProps {
  propertyIds?: string[]
  filters?: Record<string, any>
  disabled?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  isAdmin?: boolean
}

type ExportFormat = "csv" | "pdf"

export function ExportButton({
  propertyIds,
  filters,
  disabled = false,
  variant = "outline",
  size = "sm",
  isAdmin = false
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null)

  // If not admin, show locked button
  if (!isAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={size}
              disabled
              className="gap-2 opacity-50 cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Admin-only feature</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  async function handleExport(format: ExportFormat) {
    setExporting(true)
    setExportFormat(format)

    const endpoint = format === "pdf" ? "/api/export/pdf" : "/api/export"
    const fileExtension = format === "pdf" ? "pdf" : "csv"
    const mimeType = format === "pdf" ? "application/pdf" : "text/csv"

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds, filters })
      })

      if (response.ok) {
        // Get the file content
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
        a.download = `hmo-hunter-export-${new Date().toISOString().split('T')[0]}.${fileExtension}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: "Export Complete",
          description: `Your ${format.toUpperCase()} file has been downloaded`,
        })
      } else {
        const data = await response.json()

        if (data.insufficientCredits) {
          toast({
            title: "Insufficient Credits",
            description: "Export costs 10 credits. You don't have enough credits.",
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
      setExportFormat(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || exporting}
          className="gap-2"
        >
          <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
          {exporting ? `Exporting ${exportFormat?.toUpperCase()}...` : "Export"}
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Export as CSV
          <span className="text-xs text-slate-400 ml-auto">10 credits</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
          <FileText className="w-4 h-4" />
          Export as PDF
          <span className="text-xs text-slate-400 ml-auto">10 credits</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
