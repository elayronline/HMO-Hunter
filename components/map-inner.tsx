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
  showPotentialHMOLayer = true,
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

  // Load Article 4 areas from official UK Government API
  const loadArticle4Areas = async (map: maplibregl.Map) => {
    try {
      // First try official planning.data.gov.uk API
      let geojson: GeoJSON.FeatureCollection | null = null

      try {
        console.log("[Map] Fetching Article 4 data from official API...")
        const apiResponse = await fetch("/api/article4-data")
        if (apiResponse.ok) {
          geojson = await apiResponse.json()
          console.log(`[Map] Loaded ${geojson?.features?.length || 0} Article 4 areas from planning.data.gov.uk`)
        }
      } catch (apiErr) {
        console.warn("[Map] API fetch failed, falling back to static file:", apiErr)
      }

      // Fallback to static file if API fails
      if (!geojson || !geojson.features || geojson.features.length === 0) {
        console.log("[Map] Falling back to static Article 4 data...")
        const response = await fetch("/data/article4-areas.geojson")
        geojson = await response.json()
        console.log(`[Map] Loaded ${geojson?.features?.length || 0} Article 4 areas from static file`)
      }

      // Add the source
      map.addSource("article4-areas", {
        type: "geojson",
        data: geojson,
      })

      // Single flat fill for Article 4 areas - no opacity stacking on overlaps
      // Using fill-sort-key to ensure consistent rendering
      map.addLayer({
        id: "article4-fill",
        type: "fill",
        source: "article4-areas",
        paint: {
          "fill-color": "#fca5a5", // red-300 - softer base color
          "fill-opacity": 0.4, // Fixed opacity, no stacking
          "fill-antialias": true,
        },
      })

      // Bold outline - clearly defines the boundary
      map.addLayer({
        id: "article4-outline",
        type: "line",
        source: "article4-areas",
        paint: {
          "line-color": "#dc2626", // red-600
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8, 1.5,
            12, 2.5,
            16, 3.5
          ],
          "line-opacity": 0.8,
        },
      })

      // Labels visible at medium zoom - use name or fallback to authority
      map.addLayer({
        id: "article4-labels",
        type: "symbol",
        source: "article4-areas",
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name"],
            ["get", "authority"],
            "Article 4"
          ],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 9,
            14, 11,
            16, 12
          ],
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-max-width": 12,
        },
        paint: {
          "text-color": "#991b1b", // red-800
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
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
        const areaName = props?.name || "Article 4 Area"
        const authority = props?.authority || props?.organisation || ""
        const effectiveDate = props?.effective_date || props?.start_date || "Unknown"
        const description = props?.description || ""
        const source = props?.source || ""
        const verified = props?.verified

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "320px",
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
                ${verified ? '<span style="font-size: 10px; color: #16a34a; background: #dcfce7; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Verified</span>' : ''}
              </div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                ${areaName}
              </div>
              ${authority ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">${authority}</div>` : ''}
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
                Effective: ${effectiveDate}
              </div>
              ${description ? `<div style="font-size: 12px; color: #475569; margin-bottom: 8px; padding: 6px; background: #f8fafc; border-radius: 4px;">${description.substring(0, 150)}${description.length > 150 ? '...' : ''}</div>` : ''}
              <div style="font-size: 12px; color: #ef4444; background: #fef2f2; padding: 8px; border-radius: 4px;">
                <strong>Planning permission required</strong> for HMO (C3 to C4) conversions in this area.
              </div>
              ${source ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 6px; text-align: right;">Source: ${source}</div>` : ''}
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

    // Debug: Log coordinate distribution
    if (properties.length > 0) {
      const lats = properties.map(p => p.latitude).filter(Boolean)
      const lngs = properties.map(p => p.longitude).filter(Boolean)
      if (lats.length > 0 && lngs.length > 0) {
        console.log("[MapDebug] Coordinate distribution:", {
          total: properties.length,
          withCoords: lats.length,
          lat: { min: Math.min(...lats), max: Math.max(...lats), spread: Math.max(...lats) - Math.min(...lats) },
          lng: { min: Math.min(...lngs), max: Math.max(...lngs), spread: Math.max(...lngs) - Math.min(...lngs) },
          sample: properties.slice(0, 3).map(p => ({ id: p.id.slice(0, 8), lat: p.latitude, lng: p.longitude }))
        })
      }
    }

    // Add new markers - filter out properties without valid coordinates
    const validProperties = properties.filter(p => {
      const lat = Number(p.latitude)
      const lng = Number(p.longitude)
      const isValid = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
      if (!isValid) {
        console.warn("[MapDebug] Skipping property with invalid coords:", p.id, { lat: p.latitude, lng: p.longitude })
      }
      return isValid
    })

    console.log(`[MapDebug] Rendering ${validProperties.length} of ${properties.length} properties with valid coordinates`)

    validProperties.forEach((property) => {
      const el = document.createElement("div")

      const isLicensed = property.hmo_status === "Licensed HMO"
      const isPotentialHMOStatus = property.hmo_status === "Potential HMO"
      const isSelected = selectedProperty?.id === property.id
      const isArticle4 = property.article_4_area

      // Potential HMO analysis data
      const isPotentialHMO = property.is_potential_hmo
      const hmoClassification = property.hmo_classification
      const isReadyToGo = isPotentialHMO && hmoClassification === "ready_to_go"
      const isValueAdd = isPotentialHMO && hmoClassification === "value_add"

      // Determine marker colors based on Article 4 status and property type
      let bgColor: string
      let textColor = "white"
      let borderStyle = "none"
      let markerSize = "36px"
      let opacity = "1"
      let zIndex = "1"

      if (isArticle4) {
        // Properties IN Article 4 areas - distinct red circle with white border for contrast
        bgColor = "#dc2626" // red-600 - distinct from zone fill
        textColor = "white"
        borderStyle = "3px solid #ffffff" // white border for visibility against red zone
        markerSize = "36px"
        opacity = "1"
        zIndex = "5" // Above the zone fill
      } else if (isPotentialHMO && showPotentialHMOLayer) {
        // Potential HMOs NOT in Article 4 - GREEN (the opportunities!)
        if (isReadyToGo) {
          bgColor = "#22c55e" // green-500
          textColor = "white"
          borderStyle = "3px solid #16a34a" // green-600
          markerSize = "44px"
          zIndex = "10"
        } else if (isValueAdd) {
          bgColor = "#4ade80" // green-400 (lighter green for value-add)
          textColor = "#166534" // green-800
          borderStyle = "3px solid #22c55e" // green-500
          markerSize = "40px"
          zIndex = "8"
        }
      } else if (isPotentialHMOStatus) {
        // Properties with hmo_status "Potential HMO" - bright green (opportunities!)
        bgColor = "#22c55e" // green-500 - bright and visible
        textColor = "white"
        borderStyle = "3px solid #16a34a" // green-600
        markerSize = "42px"
        zIndex = "8"
      } else if (isLicensed) {
        // Licensed HMO (not in Article 4) - teal
        bgColor = "#0f766e" // teal-700
        textColor = "white"
        markerSize = "38px"
        zIndex = "3"
      } else {
        // Standard property (not in Article 4) - lighter teal
        bgColor = "#14b8a6" // teal-500
        textColor = "white"
        markerSize = "34px"
        zIndex = "2"
      }

      // Ring color for selection
      let ringStyle = "0 2px 6px rgba(0,0,0,0.2)"
      if (isSelected) {
        if (isArticle4) {
          ringStyle = "0 0 0 4px rgba(248,113,113,0.5), 0 4px 12px rgba(0,0,0,0.3)"
        } else if (isReadyToGo || isValueAdd || isPotentialHMOStatus) {
          ringStyle = "0 0 0 4px rgba(34,197,94,0.6), 0 4px 12px rgba(0,0,0,0.3)"
        } else {
          ringStyle = "0 0 0 3px rgba(13,148,136,0.5), 0 2px 6px rgba(0,0,0,0.3)"
        }
        zIndex = "20"
        opacity = "1"
      }

      // Styling
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        box-shadow: ${ringStyle};
        transform: ${isSelected ? "scale(1.15)" : "scale(1)"};
        transition: all 0.2s ease-out;
        width: ${markerSize};
        height: ${markerSize};
        background-color: ${bgColor};
        color: ${textColor};
        border: ${borderStyle};
        opacity: ${opacity};
        z-index: ${zIndex};
        position: relative;
      `

      // Show deal score for potential HMOs (not in Article 4), otherwise bedrooms
      const displayValue = isPotentialHMO && property.deal_score && !isArticle4
        ? property.deal_score.toString()
        : String(property.bedrooms)

      el.textContent = displayValue
      el.title = isArticle4
        ? `${property.bedrooms} bed - Article 4 Area (Planning permission required)`
        : isPotentialHMO
          ? `${hmoClassification === "ready_to_go" ? "Ready to Go" : "Value-Add"} HMO - Deal Score: ${property.deal_score}`
          : `${property.bedrooms} bed ${property.hmo_status || "property"}`

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
  }, [properties, selectedProperty?.id, mapReady, onPropertySelect, showPotentialHMOLayer])

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
