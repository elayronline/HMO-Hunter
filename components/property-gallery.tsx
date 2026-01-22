"use client"

import type React from "react"

import { useState } from "react"
import { ChevronLeft, ChevronRight, X, ImageIcon, Map } from "lucide-react"

interface PropertyGalleryProps {
  images?: string[] | null
  floorPlans?: string[] | null
  primaryImage?: string | null
  fallbackImage?: string
  propertyTitle: string
}

export function PropertyGallery({
  images,
  floorPlans,
  primaryImage,
  fallbackImage = "/modern-house-exterior.png",
  propertyTitle,
}: PropertyGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<"photos" | "floorplans">("photos")

  // Combine all media
  const allImages = images && images.length > 0 ? images : primaryImage ? [primaryImage] : [fallbackImage]
  const allFloorPlans = floorPlans || []

  const currentMedia = viewMode === "photos" ? allImages : allFloorPlans
  const hasFloorPlans = allFloorPlans.length > 0

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? currentMedia.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === currentMedia.length - 1 ? 0 : prev + 1))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious()
    if (e.key === "ArrowRight") goToNext()
    if (e.key === "Escape") setShowFullscreen(false)
  }

  return (
    <>
      <div className="relative w-full h-48 rounded-lg overflow-hidden group">
        <img
          src={currentMedia[selectedIndex] || "/placeholder.svg"}
          alt={`${propertyTitle} - ${viewMode === "photos" ? "Photo" : "Floor plan"} ${selectedIndex + 1}`}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => setShowFullscreen(true)}
        />

        {/* Image counter */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {selectedIndex + 1} / {currentMedia.length}
        </div>

        {/* Navigation arrows */}
        {currentMedia.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* View mode toggle */}
        {hasFloorPlans && (
          <div className="absolute top-2 left-2 flex gap-1 bg-black/70 rounded p-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewMode("photos")
                setSelectedIndex(0)
              }}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                viewMode === "photos" ? "bg-teal-600 text-white" : "text-white hover:bg-white/20"
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              Photos
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewMode("floorplans")
                setSelectedIndex(0)
              }}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                viewMode === "floorplans" ? "bg-teal-600 text-white" : "text-white hover:bg-white/20"
              }`}
            >
              <Map className="w-3 h-3" />
              Floor Plans
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {currentMedia.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {currentMedia.map((media, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                index === selectedIndex
                  ? "border-teal-600 ring-2 ring-teal-600/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <img
                src={media || "/placeholder.svg"}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen modal */}
      {showFullscreen && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
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
              src={currentMedia[selectedIndex] || "/placeholder.svg"}
              alt={`${propertyTitle} - Full size`}
              className="max-w-full max-h-full object-contain"
            />

            {currentMedia.length > 1 && (
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
              {selectedIndex + 1} / {currentMedia.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
