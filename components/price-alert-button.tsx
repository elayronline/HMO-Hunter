"use client"

import { useState } from "react"
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Loader2,
  TrendingDown,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

interface PriceAlertButtonProps {
  property: Property
  className?: string
  variant?: "icon" | "button" | "compact"
}

interface AlertSettings {
  alertType: "price_drop" | "price_threshold"
  notifyEmail: boolean
  notifyPush: boolean
  frequency: "instant" | "daily" | "weekly"
  targetPrice?: number
  priceDirection?: "below" | "above"
}

export function PriceAlertButton({
  property,
  className,
  variant = "icon",
}: PriceAlertButtonProps) {
  const [isAlertSet, setIsAlertSet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [success, setSuccess] = useState(false)

  const [settings, setSettings] = useState<AlertSettings>({
    alertType: "price_drop",
    notifyEmail: true,
    notifyPush: false,
    frequency: "instant",
  })

  const currentPrice = property.purchase_price || property.price_pcm || 0

  const handleQuickAlert = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_type: "price_drop",
          property_id: property.id,
          notify_email: true,
          frequency: "instant",
        }),
      })

      if (response.ok) {
        setIsAlertSet(true)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      }
    } catch (error) {
      console.error("Failed to create alert:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAlert = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_type: settings.alertType,
          property_id: property.id,
          target_price: settings.targetPrice,
          price_direction: settings.priceDirection,
          notify_email: settings.notifyEmail,
          notify_push: settings.notifyPush,
          frequency: settings.frequency,
        }),
      })

      if (response.ok) {
        setIsAlertSet(true)
        setShowDialog(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      }
    } catch (error) {
      console.error("Failed to create alert:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAlert = async () => {
    // In a real implementation, you'd need to track the alert ID
    setIsAlertSet(false)
  }

  if (variant === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full transition-all",
              isAlertSet
                ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                : "hover:bg-slate-100",
              success && "bg-emerald-100 text-emerald-600",
              className
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : success ? (
              <Check className="w-4 h-4" />
            ) : isAlertSet ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!isAlertSet ? (
            <>
              <DropdownMenuItem onClick={handleQuickAlert}>
                <TrendingDown className="w-4 h-4 mr-2" />
                Alert on price drop
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDialog(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Custom alert settings
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <div className="px-2 py-1.5 text-sm text-emerald-600 font-medium">
                <BellRing className="w-4 h-4 inline mr-2" />
                Alert active
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowDialog(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Edit alert
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRemoveAlert} className="text-red-600">
                <BellOff className="w-4 h-4 mr-2" />
                Remove alert
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (variant === "compact") {
    return (
      <Button
        variant={isAlertSet ? "default" : "outline"}
        size="sm"
        onClick={isAlertSet ? () => setShowDialog(true) : handleQuickAlert}
        disabled={loading}
        className={cn(
          isAlertSet && "bg-amber-500 hover:bg-amber-600",
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isAlertSet ? (
          <BellRing className="w-3.5 h-3.5" />
        ) : (
          <Bell className="w-3.5 h-3.5" />
        )}
      </Button>
    )
  }

  return (
    <>
      <Button
        variant={isAlertSet ? "default" : "outline"}
        onClick={isAlertSet ? () => setShowDialog(true) : handleQuickAlert}
        disabled={loading}
        className={cn(
          "gap-2",
          isAlertSet && "bg-amber-500 hover:bg-amber-600",
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isAlertSet ? (
          <>
            <BellRing className="w-4 h-4" />
            Alert Set
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" />
            Set Price Alert
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              Price Alert Settings
            </DialogTitle>
            <DialogDescription>
              Get notified when the price changes for this property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Price Display */}
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">Current price</div>
              <div className="text-xl font-bold text-slate-900">
                £{currentPrice.toLocaleString()}
                {property.listing_type === "rent" && <span className="text-sm font-normal text-slate-500">/month</span>}
              </div>
            </div>

            {/* Alert Type */}
            <div className="space-y-2">
              <Label>Alert type</Label>
              <Select
                value={settings.alertType}
                onValueChange={(value: "price_drop" | "price_threshold") =>
                  setSettings({ ...settings, alertType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_drop">Any price drop</SelectItem>
                  <SelectItem value="price_threshold">Specific price threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Threshold Settings */}
            {settings.alertType === "price_threshold" && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label>Target price</Label>
                    <Input
                      type="number"
                      placeholder={currentPrice.toString()}
                      value={settings.targetPrice || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, targetPrice: parseInt(e.target.value) || undefined })
                      }
                    />
                  </div>
                  <div className="w-28">
                    <Label>Direction</Label>
                    <Select
                      value={settings.priceDirection || "below"}
                      onValueChange={(value: "below" | "above") =>
                        setSettings({ ...settings, priceDirection: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="above">Above</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Preferences */}
            <div className="space-y-3">
              <Label>Notifications</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notify" className="font-normal">Email notifications</Label>
                  <Switch
                    id="email-notify"
                    checked={settings.notifyEmail}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notifyEmail: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="push-notify" className="font-normal">Push notifications</Label>
                  <Switch
                    id="push-notify"
                    checked={settings.notifyPush}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notifyPush: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={settings.frequency}
                onValueChange={(value: "instant" | "daily" | "weekly") =>
                  setSettings({ ...settings, frequency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlert}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Bell className="w-4 h-4 mr-2" />
              )}
              {isAlertSet ? "Update Alert" : "Create Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
