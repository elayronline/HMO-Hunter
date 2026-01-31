"use client"

import { useState, useEffect } from "react"
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Trash2,
  Clock,
  Save,
  FolderOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

export interface SearchFilters {
  listingType: "rent" | "purchase"
  priceRange: number[]
  propertyTypes: string[]
  selectedLocation: any
  availableNow: boolean
  studentFriendly: boolean
  petFriendly: boolean
  furnished: boolean
  licensedHmoOnly: boolean
  minEpcRating: string | null
  article4Filter: string
  licenceTypeFilter: string
  broadbandFilter: string
  ownerDataFilter: boolean
  activeSegment: string
  showPotentialHMOs: boolean
  hmoClassificationFilter: string | null
  floorAreaBandFilter: string | null
  yieldBandFilter: string | null
  epcBandFilter: string | null
  minDealScore: number
}

interface SavedSearch {
  id: string
  name: string
  filters: SearchFilters
  created_at: string
  last_used_at: string | null
  use_count: number
}

interface SavedSearchesProps {
  currentFilters: SearchFilters
  onLoadFilters: (filters: SearchFilters) => void
  isLoggedIn: boolean
}

export function SavedSearches({ currentFilters, onLoadFilters, isLoggedIn }: SavedSearchesProps) {
  const [expanded, setExpanded] = useState(false)
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [searchName, setSearchName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isLoggedIn && expanded) {
      fetchSearches()
    }
  }, [isLoggedIn, expanded])

  async function fetchSearches() {
    setLoading(true)
    try {
      const response = await fetch('/api/saved-searches')
      if (response.ok) {
        const data = await response.json()
        setSearches(data)
      }
    } catch (error) {
      console.error('Error fetching searches:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveSearch() {
    if (!searchName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for this search",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName.trim(),
          filters: currentFilters
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Search Saved",
          description: data.warning || `"${searchName}" has been saved`
        })
        setSaveDialogOpen(false)
        setSearchName("")
        fetchSearches()
      } else if (data.limitReached) {
        toast({
          title: "Limit Reached",
          description: `You've reached your limit of ${data.limit} saved searches`,
          variant: "destructive"
        })
      } else if (data.insufficientCredits) {
        toast({
          title: "Insufficient Credits",
          description: "You don't have enough credits to save this search",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save search",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error saving search:', error)
      toast({
        title: "Error",
        description: "Failed to save search",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  async function loadSearch(search: SavedSearch) {
    try {
      // Update last_used_at
      await fetch('/api/saved-searches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: search.id })
      })

      onLoadFilters(search.filters)
      toast({
        title: "Search Loaded",
        description: `Applied filters from "${search.name}"`
      })
    } catch (error) {
      console.error('Error loading search:', error)
    }
  }

  async function deleteSearch(searchId: string, searchName: string) {
    try {
      const response = await fetch(`/api/saved-searches?id=${searchId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Search Deleted",
          description: `"${searchName}" has been removed`
        })
        setSearches(prev => prev.filter(s => s.id !== searchId))
      }
    } catch (error) {
      console.error('Error deleting search:', error)
    }
  }

  if (!isLoggedIn) {
    return null
  }

  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-4"
      >
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-sm text-slate-900">Saved Searches</span>
          {searches.length > 0 && (
            <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded">
              {searches.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Save current search button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="w-4 h-4" />
            Save Current Search
          </Button>

          {/* Saved searches list */}
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-2">Loading...</p>
          ) : searches.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              No saved searches yet
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group"
                >
                  <button
                    onClick={() => loadSearch(search)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {search.name}
                      </span>
                    </div>
                    {search.last_used_at && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">
                          {new Date(search.last_used_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSearch(search.id, search.name)
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Current Search</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter a name for this search..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSearch()}
            />
            <p className="text-xs text-slate-500 mt-2">
              Costs 2 credits. You can save up to 10 searches.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSearch} disabled={saving}>
              {saving ? "Saving..." : "Save Search"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
