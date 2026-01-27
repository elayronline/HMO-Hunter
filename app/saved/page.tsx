"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Heart,
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Trash2,
  ExternalLink,
  Home,
} from "lucide-react"
import type { Property } from "@/lib/types/database"

interface SavedProperty {
  id: string
  property_id: string
  property: Property
  created_at: string
}

export default function SavedPropertiesPage() {
  const router = useRouter()
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Fetch saved properties
        const { data } = await supabase
          .from("saved_properties")
          .select(`
            id,
            property_id,
            created_at,
            property:properties(*)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (data) {
          setSavedProperties(data as any)
        }
      }
      setLoading(false)
    }

    checkUser()
  }, [])

  const removeSaved = async (savedId: string) => {
    const supabase = createClient()
    await supabase.from("saved_properties").delete().eq("id", savedId)
    setSavedProperties(prev => prev.filter(p => p.id !== savedId))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Sign in to view saved properties</h2>
          <p className="text-slate-600 mb-4">Create an account or sign in to save and manage your favourite properties.</p>
          <Button onClick={() => router.push("/auth/login")} className="bg-teal-600 hover:bg-teal-700">
            Sign In
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-600 fill-teal-600" />
                Saved Properties
              </h1>
              <p className="text-sm text-slate-500">{savedProperties.length} properties saved</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Map
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {savedProperties.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No saved properties yet</h2>
            <p className="text-slate-600 mb-6">
              Browse properties and click the heart icon to save them for later.
            </p>
            <Button onClick={() => router.push("/")} className="bg-teal-600 hover:bg-teal-700">
              Browse Properties
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProperties.map((saved) => {
              const property = saved.property
              if (!property) return null

              return (
                <Card key={saved.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Property Image */}
                  <div className="relative h-48 bg-slate-200">
                    <img
                      src={property.image_url || property.primary_image || "/modern-house-exterior.png"}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeSaved(saved.id)}
                      className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-sm transition-colors"
                      title="Remove from saved"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-teal-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
                        {property.listing_type === "purchase"
                          ? `£${property.purchase_price?.toLocaleString()}`
                          : `£${property.price_pcm?.toLocaleString()}/mo`
                        }
                      </span>
                    </div>
                  </div>

                  {/* Property Details */}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">{property.title}</h3>
                    <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="line-clamp-1">{property.address}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-1">
                        <Bed className="w-4 h-4" />
                        <span>{property.bedrooms} bed</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="w-4 h-4" />
                        <span>{property.bathrooms} bath</span>
                      </div>
                      {property.epc_rating && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ["A", "B", "C"].includes(property.epc_rating)
                            ? "bg-green-100 text-green-700"
                            : ["D", "E"].includes(property.epc_rating)
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          EPC {property.epc_rating}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/?property=${property.id}`)}
                      >
                        View on Map
                      </Button>
                      {property.source_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(property.source_url!, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Saved Date */}
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                    Saved {new Date(saved.created_at).toLocaleDateString()}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
