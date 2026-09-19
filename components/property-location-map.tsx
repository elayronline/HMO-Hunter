"use client"

import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { MAP_STYLE, withStadiaKey } from "@/lib/map/stadia"

interface PropertyLocationMapProps {
  latitude: number
  longitude: number
  address?: string
  className?: string
}

export function PropertyLocationMap({ latitude, longitude, address, className }: PropertyLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom: 15,
      attributionControl: false,
      transformRequest: (url: string) => ({ url: withStadiaKey(url) }),
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    const marker = new maplibregl.Marker({ color: "#0d9488" })
      .setLngLat([longitude, latitude])

    if (address) {
      marker.setPopup(new maplibregl.Popup({ offset: 25 }).setText(address))
    }

    marker.addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, address])

  return (
    <div
      ref={mapContainerRef}
      className={className || "w-full h-[300px] rounded-xl overflow-hidden"}
    />
  )
}
