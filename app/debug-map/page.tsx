"use client"

import { useEffect, useState } from "react"

interface DebugProperty {
  id: string
  title: string
  lat: number
  lng: number
  hmo_status: string
}

export default function DebugMapPage() {
  const [data, setData] = useState<{
    stats: { total: number; lat: { min: number; max: number; spread: number }; lng: { min: number; max: number; spread: number } };
    properties: DebugProperty[];
    byStatus: Record<string, number>;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState("London")

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/map-data?city=${encodeURIComponent(city)}`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error("Failed to fetch:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [city])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!data) {
    return <div className="p-8">No data</div>
  }

  // Calculate bounds for scaling
  const minLat = data.stats.lat.min
  const maxLat = data.stats.lat.max
  const minLng = data.stats.lng.min
  const maxLng = data.stats.lng.max
  const latSpread = maxLat - minLat || 0.01
  const lngSpread = maxLng - minLng || 0.01

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Map Data Debug</h1>

      <div className="mb-4">
        <label className="mr-2">City:</label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="London">London</option>
          <option value="Manchester">Manchester</option>
          <option value="Birmingham">Birmingham</option>
          <option value="Leeds">Leeds</option>
          <option value="Newcastle">Newcastle</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Stats */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">Statistics</h2>
          <pre className="text-sm bg-slate-100 p-2 rounded overflow-auto">
{JSON.stringify({
  total: data.stats.total,
  lat: data.stats.lat,
  lng: data.stats.lng,
  byStatus: data.byStatus,
}, null, 2)}
          </pre>
        </div>

        {/* Visual representation */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">Coordinate Distribution (scaled to view)</h2>
          <div className="relative bg-slate-200 w-full h-64 rounded overflow-hidden border">
            {data.properties?.map((prop, idx) => {
              // Scale coordinates to fit in the view
              const x = ((prop.lng - minLng) / lngSpread) * 100
              const y = 100 - ((prop.lat - minLat) / latSpread) * 100 // Invert Y

              // Color based on status
              const colors: Record<string, string> = {
                "Licensed HMO": "#0f766e",
                "Potential HMO": "#22c55e",
                "Standard HMO": "#14b8a6",
              }
              const color = colors[prop.hmo_status] || "#6b7280"

              return (
                <div
                  key={prop.id || idx}
                  className="absolute w-2 h-2 rounded-full transform -translate-x-1 -translate-y-1"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    backgroundColor: color,
                  }}
                  title={`${prop.title}\nLat: ${prop.lat}\nLng: ${prop.lng}`}
                />
              )
            })}

            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-300" />
            </div>

            {/* Labels */}
            <div className="absolute top-1 left-1 text-xs text-slate-500">
              NW ({minLng.toFixed(4)}, {maxLat.toFixed(4)})
            </div>
            <div className="absolute top-1 right-1 text-xs text-slate-500 text-right">
              NE ({maxLng.toFixed(4)}, {maxLat.toFixed(4)})
            </div>
            <div className="absolute bottom-1 left-1 text-xs text-slate-500">
              SW ({minLng.toFixed(4)}, {minLat.toFixed(4)})
            </div>
            <div className="absolute bottom-1 right-1 text-xs text-slate-500 text-right">
              SE ({maxLng.toFixed(4)}, {minLat.toFixed(4)})
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Shows all {data.stats.total} properties scaled to fit.
            Spread: {(latSpread * 111).toFixed(1)}km (lat) x {(lngSpread * 70).toFixed(1)}km (lng)
          </p>
        </div>
      </div>

      {/* Property list */}
      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="font-bold mb-2">Sample Properties (first 20)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Latitude</th>
              <th className="text-left p-2">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {data.properties?.slice(0, 20).map((prop, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-2">{prop.title?.substring(0, 40)}</td>
                <td className="p-2">{prop.hmo_status}</td>
                <td className="p-2 font-mono text-xs">{prop.lat}</td>
                <td className="p-2 font-mono text-xs">{prop.lng}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
