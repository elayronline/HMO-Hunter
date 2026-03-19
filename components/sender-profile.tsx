"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { User, Building2, Phone, Mail, Globe, ImagePlus, X, Save } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export interface SenderProfile {
  name: string
  company: string
  phone: string
  email: string
  address: string
  website: string
  logoUrl: string | null
}

const DEFAULT_PROFILE: SenderProfile = {
  name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  logoUrl: null,
}

/**
 * Load sender profile from user metadata
 */
export async function loadSenderProfile(): Promise<SenderProfile> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.user_metadata?.sender_profile) {
    return {
      ...DEFAULT_PROFILE,
      name: user?.user_metadata?.full_name || "",
      email: user?.email || "",
    }
  }

  return { ...DEFAULT_PROFILE, ...user.user_metadata.sender_profile }
}

/**
 * Save sender profile to user metadata
 */
export async function saveSenderProfile(profile: SenderProfile): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({
    data: { sender_profile: profile },
  })
  return !error
}

interface SenderProfileEditorProps {
  open: boolean
  onClose: () => void
  onSave: (profile: SenderProfile) => void
  initialProfile?: SenderProfile
}

export function SenderProfileEditor({ open, onClose, onSave, initialProfile }: SenderProfileEditorProps) {
  const [profile, setProfile] = useState<SenderProfile>(initialProfile || DEFAULT_PROFILE)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialProfile) setProfile(initialProfile)
  }, [initialProfile])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG)")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB")
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")

      const ext = file.name.split(".").pop() || "png"
      const path = `logos/${user.id}/logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("user-assets")
        .upload(path, file, { upsert: true })

      if (uploadError) {
        // If bucket doesn't exist, use base64 data URL as fallback
        const reader = new FileReader()
        reader.onload = () => {
          setProfile(prev => ({ ...prev, logoUrl: reader.result as string }))
          toast.success("Logo added (stored locally)")
        }
        reader.readAsDataURL(file)
        return
      }

      const { data: urlData } = supabase.storage
        .from("user-assets")
        .getPublicUrl(path)

      setProfile(prev => ({ ...prev, logoUrl: urlData.publicUrl }))
      toast.success("Logo uploaded")
    } catch {
      // Fallback to base64
      const reader = new FileReader()
      reader.onload = () => {
        setProfile(prev => ({ ...prev, logoUrl: reader.result as string }))
        toast.success("Logo added")
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = () => {
    setProfile(prev => ({ ...prev, logoUrl: null }))
  }

  const handleSave = async () => {
    setSaving(true)
    const success = await saveSenderProfile(profile)
    setSaving(false)

    if (success) {
      toast.success("Sender profile saved")
      onSave(profile)
      onClose()
    } else {
      toast.error("Failed to save profile")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Sender Profile</DialogTitle>
          <DialogDescription>
            Your details appear on outreach letters and emails. Add your logo for a professional letterhead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-3">
          {/* Logo upload */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Company Logo</label>
            <div className="flex items-center gap-3">
              {profile.logoUrl ? (
                <div className="relative group">
                  <img
                    src={profile.logoUrl}
                    alt="Logo"
                    className="h-16 w-auto max-w-[200px] object-contain rounded border bg-white p-1"
                  />
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                  {uploading ? "Uploading..." : "Upload Logo"}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {profile.logoUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-teal-600 hover:underline"
                >
                  Change
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, or SVG. Max 2MB. Appears on letter header.</p>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Full Name</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                  className="pl-9"
                  placeholder="John Smith"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Company</label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={profile.company}
                  onChange={(e) => setProfile(p => ({ ...p, company: e.target.value }))}
                  className="pl-9"
                  placeholder="HMO Investments Ltd"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Phone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                  className="pl-9"
                  placeholder="07700 900 000"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={profile.email}
                  onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                  className="pl-9"
                  placeholder="john@company.co.uk"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Business Address</label>
            <Input
              value={profile.address}
              onChange={(e) => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="123 Business Park, Manchester, M1 1AA"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Website</label>
            <div className="relative">
              <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={profile.website}
                onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
                className="pl-9"
                placeholder="www.company.co.uk"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-white p-4 mt-2">
            <p className="text-[10px] text-slate-400 mb-2">LETTER HEADER PREVIEW</p>
            <div className="flex items-start justify-between">
              {profile.logoUrl && (
                <img src={profile.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
              )}
              <div className="text-right text-xs text-slate-600 leading-relaxed">
                {profile.name && <p className="font-semibold">{profile.name}</p>}
                {profile.company && <p>{profile.company}</p>}
                {profile.address && <p>{profile.address}</p>}
                {profile.phone && <p>{profile.phone}</p>}
                {profile.email && <p>{profile.email}</p>}
                {profile.website && <p>{profile.website}</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
