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
  showArticle4Overlay = true,
  onArticle4AreaClick,
}: MainMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [article4Loaded, setArticle4Loaded] = useState(false)

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

        // Load Article 4 areas GeoJSON
        loadArticle4Areas(map)
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

  // Load Article 4 areas
  const loadArticle4Areas = async (map: maplibregl.Map) => {
    try {
      const response = await fetch("/data/article4-areas.geojson")
      const geojson = await response.json()

      // Add the source
      map.addSource("article4-areas", {
        type: "geojson",
        data: geojson,
      })

      // Add fill layer with gradient/heatmap effect
      map.addLayer({
        id: "article4-fill",
        type: "fill",
        source: "article4-areas",
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.25,
        },
      })

      // Add outline layer
      map.addLayer({
        id: "article4-outline",
        type: "line",
        source: "article4-areas",
        paint: {
          "line-color": "#dc2626",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      })

      // Add labels for Article 4 areas
      map.addLayer({
        id: "article4-labels",
        type: "symbol",
        source: "article4-areas",
        layout: {
          "text-field": ["get", "authority"],
          "text-size": 11,
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "#991b1b",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
        minzoom: 10,
      })

      // Add click handler for Article 4 areas
      map.on("click", "article4-fill", (e) => {
        if (!e.features || !e.features[0]) return

        const props = e.features[0].properties
        const coordinates = e.lngLat

        // Remove any existing popup
        if (popupRef.current) {
          popupRef.current.remove()
        }

        // Create popup with area info
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "300px",
        })
          .setLngLat(coordinates)
          .setHTML(`
            <div style="padding: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <strong style="color: #dc2626;">Article 4 Direction</strong>
              </div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                ${props?.name || "Article 4 Area"}
              </div>
              <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                ${props?.authority || "Local Authority"}
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
                Effective: ${props?.effective_date || "Unknown"}
              </div>
              <div style="font-size: 12px; color: #ef4444; background: #fef2f2; padding: 8px; border-radius: 4px;">
                <strong>Planning permission required</strong> for HMO (C3 to C4) conversions in this area.
              </div>
            </div>
          `)
          .addTo(map)

        popupRef.current = popup

        // Call the callback if provided
        if (onArticle4AreaClick && props) {
          onArticle4AreaClick({
            name: props.name || "",
            authority: props.authority || "",
            effective_date: props.effective_date || "",
            restrictions: props.restrictions || "",
          })
        }
      })

      // Change cursor on hover
      map.on("mouseenter", "article4-fill", () => {
        map.getCanvas().style.cursor = "pointer"
      })

      map.on("mouseleave", "article4-fill", () => {
        map.getCanvas().style.cursor = ""
      })

      setArticle4Loaded(true)
      console.log("Article 4 areas loaded:", geojson.features.length, "areas")
    } catch (err) {
      console.error("Failed to load Article 4 areas:", err)
    }
  }

  // Toggle Article 4 layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapReady || !article4Loaded) return

    const visibility = showArticle4Overlay ? "visible" : "none"

    try {
      mapRef.current.setLayoutProperty("article4-fill", "visibility", visibility)
      mapRef.current.setLayoutProperty("article4-outline", "visibility", visibility)
      mapRef.current.setLayoutProperty("article4-labels", "visibility", visibility)
    } catch (err) {
      // Layer might not exist yet
      console.log("Article 4 layers not ready yet")
    }
  }, [showArticle4Overlay, mapReady, article4Loaded])

  // Initialize map on mount
  useEffect(() => {
    initMap()

    return () => {
      if (popupRef.current) {
        popupRef.current.remove()
      }
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
      const isArticle4 = property.article_4_area

      // Styling - add orange ring for Article 4 properties
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        box-shadow: ${isSelected ? "0 0 0 3px rgba(13,148,136,0.5), 0 2px 6px rgba(0,0,0,0.3)" : isArticle4 ? "0 0 0 3px rgba(239,68,68,0.5), 0 2px 6px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.3)"};
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
