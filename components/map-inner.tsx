"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import maplibregl from "maplibre-gl"
import type { MainMapViewProps } from "./main-map-view"

export function MapInner({
  selectedCity,
  properties,
  selectedProperty,
  onPropertySelect,
  loading,
}: MainMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Check if container has dimensions
    const rect = mapContainerRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      // Retry after a short delay
      setTimeout(initMap, 100)
      return
    }

    try {
      console.log("Initializing map with city:", selectedCity.name, "Container size:", rect.width, "x", rect.height)

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [selectedCity.longitude, selectedCity.latitude],
        zoom: selectedCity.zoom,
        pixelRatio: window.devicePixelRatio || 1,
        antialias: true,
      })

      map.addControl(new maplibregl.NavigationControl(), "top-right")

      map.on("load", () => {
        console.log("Map loaded successfully")
        setMapReady(true)
        // Trigger resize to ensure proper rendering
        map.resize()
      })

      map.on("error", (e) => {
        console.error("Map error:", e)
      })

      mapRef.current = map
    } catch (err) {
      console.error("Failed to initialize map:", err)
      setError(err instanceof Error ? err.message : "Failed to initialize map")
    }
  }, [selectedCity.name, selectedCity.longitude, selectedCity.latitude, selectedCity.zoom])

  // Initialize map on mount
  useEffect(() => {
    initMap()

    return () => {
      if (mapRef.current) {
        console.log("Cleaning up map")
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [initMap])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize()
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Fly to new city
  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    console.log("Flying to city:", selectedCity.name)
    mapRef.current.flyTo({
      center: [selectedCity.longitude, selectedCity.latitude],
      zoom: selectedCity.zoom,
      duration: 1500,
    })
  }, [selectedCity.longitude, selectedCity.latitude, selectedCity.zoom, mapReady])

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    // Clear old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    console.log("Adding", properties.length, "markers")

    // Add new markers
    properties.forEach((property) => {
      const el = document.createElement("div")

      const isLicensed = property.hmo_status === "Licensed HMO"
      const isPotential = property.hmo_status === "Potential HMO"
      const isSelected = selectedProperty?.id === property.id

      // Styling
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        box-shadow: ${isSelected ? "0 0 0 3px rgba(13,148,136,0.5), 0 2px 6px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.3)"};
        transform: ${isSelected ? "scale(1.1)" : "scale(1)"};
        transition: transform 0.2s;
        width: ${isLicensed ? "40px" : "36px"};
        height: ${isLicensed ? "40px" : "36px"};
        background-color: ${isPotential ? "white" : (isLicensed ? "#0f766e" : "#0d9488")};
        color: ${isPotential ? "#0d9488" : "white"};
        border: ${isPotential ? "2px solid #0d9488" : "none"};
      `

      el.textContent = String(property.bedrooms)
      el.onclick = () => onPropertySelect(property)

      try {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([Number(property.longitude), Number(property.latitude)])
          .addTo(mapRef.current!)

        markersRef.current.push(marker)
      } catch (err) {
        console.error("Failed to add marker:", err)
      }
    })
  }, [properties, selectedProperty?.id, mapReady, onPropertySelect])

  if (error) {
    return (
      <div style={{ position: 'absolute', inset: 0 }} className="bg-red-50 flex items-center justify-center">
        <div className="text-red-600 text-center p-4">
          <div className="font-medium mb-2">Map Error</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', inset: 0 }}
      />

      {loading && (
        <div style={{ position: 'absolute', inset: 0 }} className="bg-white/60 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex items-center gap-2 text-slate-600">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading properties...</span>
          </div>
        </div>
      )}

      {!mapReady && !error && (
        <div style={{ position: 'absolute', inset: 0 }} className="bg-slate-100 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-slate-600">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading map...</span>
          </div>
        </div>
      )}
    </div>
  )
}
