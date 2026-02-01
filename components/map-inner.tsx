"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { MainMapViewProps } from "./main-map-view"

// Stadia Maps - Alidade Smooth (modern, clean style)
const MAP_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth.json"

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
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const markerElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
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
        style: MAP_STYLE,
        center: [selectedCity.longitude, selectedCity.latitude],
        zoom: selectedCity.zoom,
        pixelRatio: window.devicePixelRatio || 1,
        antialias: true,
        attributionControl: false, // Hide MapLibre attribution
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
        console.error("Error details:", e.error?.message || JSON.stringify(e))
      })

      map.on("sourcedata", (e) => {
        console.log("Source data:", e.sourceId, e.isSourceLoaded ? "loaded" : "loading")
      })

      mapRef.current = map
      console.log("Map instance created successfully")
    } catch (err) {
      console.error("Failed to initialize map:", err)
      setError(err instanceof Error ? err.message : "Failed to initialize map")
    }
  }, [selectedCity.name, selectedCity.longitude, selectedCity.latitude, selectedCity.zoom])

  // Load Article 4 areas from official UK Government API
  const loadArticle4Areas = async (map: maplibregl.Map) => {
    try {
      // Fetch from our API which uses planning.data.gov.uk (accurate polygon boundaries)
      console.log("[Map] Fetching Article 4 data from official API...")
      const apiResponse = await fetch("/api/article4-data")

      if (!apiResponse.ok) {
        console.warn("[Map] API fetch failed:", apiResponse.status)
        return
      }

      const geojson: GeoJSON.FeatureCollection = await apiResponse.json()

      if (!geojson?.features || geojson.features.length === 0) {
        console.warn("[Map] No Article 4 areas available")
        return
      }

      console.log(`[Map] Loaded ${geojson.features.length} Article 4 areas with accurate boundaries`)

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
      console.log("Article 4 areas loaded:", geojson?.features?.length || 0, "areas")
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
      // Clear all markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current.clear()
      markerElementsRef.current.clear()

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

  // Helper to get marker style properties for a property
  const getMarkerStyle = useCallback((property: typeof properties[0], isSelected: boolean, showPotentialHMO: boolean) => {
    const isLicensed = property.hmo_status === "Licensed HMO"
    const isPotentialHMOStatus = property.hmo_status === "Potential HMO"
    const isArticle4 = property.article_4_area
    const isPotentialHMO = property.is_potential_hmo
    const hmoClassification = property.hmo_classification
    const isReadyToGo = isPotentialHMO && hmoClassification === "ready_to_go"
    const isValueAdd = isPotentialHMO && hmoClassification === "value_add"

    // Check for expired licence - HMOs that were previously licensed but licence has expired
    const hasExpiredLicence = property.licence_status === "expired"

    // Check for title owner and licence holder information
    const hasTitleOwner = !!(property.owner_name || property.company_name || property.company_number)
    const hasLicenceHolder = !!(property.licensed_hmo || property.licence_status === "active" || property.hmo_status?.includes("Licensed"))
    const hasCompleteInfo = hasTitleOwner && hasLicenceHolder
    const hasPartialInfo = hasTitleOwner || hasLicenceHolder

    let bgColor: string
    let textColor = "white"
    let borderStyle = "none"
    let markerSize = 36

    // Priority order matches legend categories:
    // 1. Article 4 (Restrictions) - Red
    // 2. Expired Licence (Requires Action) - Amber
    // 3. Ready to Go / Value-Add (Opportunities) - Green
    // 4. Licensed HMO (Ready to Operate) - Teal

    if (isArticle4) {
      // RESTRICTIONS - Red with white border (matches legend)
      bgColor = "#dc2626" // red-600
      textColor = "white"
      borderStyle = "3px solid #ffffff"
      markerSize = 38
    } else if (hasExpiredLicence) {
      // REQUIRES ACTION - Amber with amber border (matches legend)
      bgColor = "#f59e0b" // amber-500
      textColor = "white"
      borderStyle = "3px solid #d97706" // amber-600
      markerSize = 40
    } else if ((isPotentialHMO || isPotentialHMOStatus) && showPotentialHMO) {
      // OPPORTUNITIES - Green colors (matches legend)
      if (isReadyToGo) {
        // Ready to Go - Dark green with darker border (matches legend)
        bgColor = "#16a34a" // green-600
        textColor = "white"
        borderStyle = "3px solid #15803d" // green-700
        markerSize = hasCompleteInfo ? 44 : (hasPartialInfo ? 40 : 36)
      } else if (isValueAdd) {
        // Value-Add - Medium green with green border (matches legend)
        bgColor = "#4ade80" // green-400
        textColor = "#14532d" // green-900
        borderStyle = "3px solid #22c55e" // green-500
        markerSize = hasCompleteInfo ? 42 : (hasPartialInfo ? 38 : 34)
      } else {
        // Unclassified potential HMO - use Ready to Go style
        bgColor = "#16a34a" // green-600
        textColor = "white"
        borderStyle = "3px solid #15803d" // green-700
        markerSize = 36
      }
    } else if (isLicensed) {
      // READY TO OPERATE - Teal (matches legend)
      bgColor = "#0f766e" // teal-700
      textColor = "white"
      markerSize = 38
    } else {
      // Standard property - lighter teal (not shown in legend, minimal visibility)
      bgColor = "#14b8a6" // teal-500
      textColor = "white"
      markerSize = 32
    }

    // Selection ring style
    let boxShadow = "0 2px 6px rgba(0,0,0,0.2)"
    if (isSelected) {
      if (isArticle4) {
        boxShadow = "0 0 0 4px rgba(248,113,113,0.5), 0 4px 12px rgba(0,0,0,0.3)"
      } else if (isReadyToGo || isValueAdd || isPotentialHMOStatus) {
        boxShadow = "0 0 0 4px rgba(34,197,94,0.6), 0 4px 12px rgba(0,0,0,0.3)"
      } else {
        boxShadow = "0 0 0 3px rgba(13,148,136,0.5), 0 2px 6px rgba(0,0,0,0.3)"
      }
    }

    const displayValue = isPotentialHMO && property.deal_score && !isArticle4
      ? property.deal_score.toString()
      : String(property.bedrooms)

    // Enhanced title showing contact info status
    let title = ""
    if (isArticle4) {
      title = `${property.bedrooms} bed - Article 4 Area (Planning permission required)`
    } else if (isPotentialHMO) {
      const infoStatus = hasCompleteInfo ? "Complete Info" : hasPartialInfo ? "Partial Info" : "No Contact Info"
      title = `${hmoClassification === "ready_to_go" ? "Ready to Go" : "Value-Add"} HMO - Score: ${property.deal_score} (${infoStatus})`
    } else {
      title = `${property.bedrooms} bed ${property.hmo_status || "property"}`
    }

    return {
      bgColor,
      textColor,
      borderStyle,
      markerSize,
      boxShadow,
      displayValue,
      title,
      isSelected,
    }
  }, [])

  // Helper to apply styles to a marker element without affecting positioning
  const applyMarkerStyles = useCallback((el: HTMLDivElement, style: ReturnType<typeof getMarkerStyle>) => {
    // Only update visual properties - never touch transform or position
    el.style.width = `${style.markerSize}px`
    el.style.height = `${style.markerSize}px`
    el.style.backgroundColor = style.bgColor
    el.style.color = style.textColor
    el.style.border = style.borderStyle
    el.style.boxShadow = style.boxShadow
    el.textContent = style.displayValue
    el.title = style.title
  }, [])

  // Update markers - use stable positioning
  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    // Filter properties with valid coordinates
    const validProperties = properties.filter(p => {
      const lat = Number(p.latitude)
      const lng = Number(p.longitude)
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
    })

    const currentPropertyIds = new Set(validProperties.map(p => p.id))
    const existingMarkerIds = new Set(markersRef.current.keys())

    // Remove markers for properties that no longer exist
    for (const id of existingMarkerIds) {
      if (!currentPropertyIds.has(id)) {
        const marker = markersRef.current.get(id)
        if (marker) {
          marker.remove()
          markersRef.current.delete(id)
          markerElementsRef.current.delete(id)
        }
      }
    }

    // Add or update markers
    validProperties.forEach((property) => {
      const existingMarker = markersRef.current.get(property.id)
      const existingElement = markerElementsRef.current.get(property.id)
      const isSelected = selectedProperty?.id === property.id
      const style = getMarkerStyle(property, isSelected, showPotentialHMOLayer)

      if (existingMarker && existingElement) {
        // Update existing marker - only change visual styles, not position
        applyMarkerStyles(existingElement, style)
      } else {
        // Create new marker element with base styles that won't change
        const el = document.createElement("div")

        // Set static styles that don't need updating
        el.style.display = "flex"
        el.style.alignItems = "center"
        el.style.justifyContent = "center"
        el.style.borderRadius = "50%"
        el.style.fontWeight = "bold"
        el.style.fontSize = "12px"
        el.style.cursor = "pointer"

        // Apply dynamic styles
        applyMarkerStyles(el, style)

        el.onclick = (e) => {
          e.stopPropagation()
          onPropertySelect(property)
        }

        try {
          const marker = new maplibregl.Marker({
            element: el,
            anchor: "center"
          })
            .setLngLat([Number(property.longitude), Number(property.latitude)])
            .addTo(mapRef.current!)

          markersRef.current.set(property.id, marker)
          markerElementsRef.current.set(property.id, el)
        } catch (err) {
          console.error("Failed to add marker:", err)
        }
      }
    })
  }, [properties, selectedProperty?.id, mapReady, onPropertySelect, showPotentialHMOLayer, getMarkerStyle, applyMarkerStyles])

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
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        className="maplibregl-map"
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
