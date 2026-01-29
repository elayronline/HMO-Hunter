"use client"

import { useState } from "react"
import {
  FileText,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface FloorPlanSectionProps {
  /** Array of floor plan image URLs from the listing */
  floorPlans?: string[] | null
  propertyTitle: string
  className?: string
}

export function FloorPlanSection({
  floorPlans,
  propertyTitle,
  className = "",
}: FloorPlanSectionProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [imageError, setImageError] = useState<Record<number, boolean>>({})

  const validFloorPlans = (floorPlans || []).filter(fp => fp && fp.length > 0)
  const hasFloorPlanImages = validFloorPlans.length > 0

  if (!hasFloorPlanImages) {
    return (
      <div className={`p-4 bg-slate-50 border border-slate-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-3 text-slate-500">
          <div className="p-2 bg-slate-100 rounded-lg">
            <ImageOff className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">No Floor Plan Images</p>
            <p className="text-xs text-slate-400">Floor plan images not provided in the listing</p>
          </div>
        </div>
      </div>
    )
  }

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? validFloorPlans.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === validFloorPlans.length - 1 ? 0 : prev + 1))
  }

  return (
    <div className={`rounded-xl overflow-hidden border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-white" />
            <span className="text-white font-bold text-sm uppercase tracking-wide">Floor Plan Images</span>
          </div>
          <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">
            {validFloorPlans.length} {validFloorPlans.length === 1 ? "image" : "images"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Floor Plan Images */}
        {hasFloorPlanImages && (
          <div className="space-y-3">
            {/* Main Image View */}
            <div className="relative bg-white rounded-lg overflow-hidden border border-emerald-200 group">
              {validFloorPlans[selectedIndex]?.toLowerCase().endsWith(".pdf") ? (
                <a
                  href={validFloorPlans[selectedIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center py-12 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <FileText className="w-16 h-16 text-slate-400 mb-3" />
                  <span className="text-sm text-slate-600 font-medium">View PDF Floor Plan</span>
                  <span className="text-xs text-slate-400 mt-1">Click to open in new tab</span>
                </a>
              ) : imageError[selectedIndex] ? (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50">
                  <ImageOff className="w-12 h-12 text-slate-300 mb-2" />
                  <span className="text-sm text-slate-500">Failed to load image</span>
                </div>
              ) : (
                <>
                  <img
                    src={validFloorPlans[selectedIndex]}
                    alt={`${propertyTitle} - Floor plan ${selectedIndex + 1}`}
                    className="w-full h-auto max-h-[400px] object-contain cursor-pointer"
                    onClick={() => setShowFullscreen(true)}
                    onError={() => setImageError(prev => ({ ...prev, [selectedIndex]: true }))}
                  />

                  {/* Fullscreen button */}
                  <button
                    onClick={() => setShowFullscreen(true)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="View fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {/* Navigation arrows */}
                  {validFloorPlans.length > 1 && (
                    <>
                      <button
                        onClick={goToPrevious}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={goToNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Image counter */}
                  {validFloorPlans.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                      {selectedIndex + 1} / {validFloorPlans.length}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {validFloorPlans.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {validFloorPlans.map((fp, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      index === selectedIndex
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    {fp.toLowerCase().endsWith(".pdf") ? (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-400" />
                      </div>
                    ) : (
                      <img
                        src={fp}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg"
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500 italic">
              Floor plan images sourced from the property listing
            </p>
          </div>
        )}

      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && hasFloorPlanImages && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            onClick={() => setShowFullscreen(false)}
            className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors z-10"
          >
            <X className="w-8 h-8" />
          </button>

          <div
            className="relative w-full h-full flex items-center justify-center p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={validFloorPlans[selectedIndex]}
              alt={`${propertyTitle} - Floor plan full size`}
              className="max-w-full max-h-full object-contain"
            />

            {validFloorPlans.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              Floor Plan {selectedIndex + 1} / {validFloorPlans.length}
            </div>

            {/* Download button */}
            <a
              href={validFloorPlans[selectedIndex]}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
