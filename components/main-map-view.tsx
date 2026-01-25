"use client"

import dynamic from "next/dynamic"
import type { Property } from "@/lib/types/database"
import type { UKCity } from "@/lib/data/uk-cities"

export interface MainMapViewProps {
  selectedCity: UKCity
  properties: Property[]
  selectedProperty: Property | null
  onPropertySelect: (property: Property) => void
  loading: boolean
  showArticle4Overlay?: boolean
  onArticle4AreaClick?: (areaInfo: Article4AreaInfo) => void
}

export interface Article4AreaInfo {
  name: string
  authority: string
  effective_date: string
  restrictions: string
}

// Loading placeholder
function MapLoadingPlaceholder() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} className="bg-slate-100 flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-600">
        <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading map...</span>
      </div>
    </div>
  )
}

// Dynamically import the map component with SSR disabled
const MapComponent = dynamic(() => import("./map-inner").then((mod) => mod.MapInner), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
})

export function MainMapView(props: MainMapViewProps) {
  return <MapComponent {...props} />
}
