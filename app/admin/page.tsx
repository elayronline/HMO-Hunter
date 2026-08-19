"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  Shield,
  Activity,
  RefreshCw,
  ChevronLeft,
  Crown,
  User as UserIcon,
  MoreVertical,
  Ban,
  CheckCircle,
  UserX
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { csrfFetch } from "@/lib/csrf-client"

interface UserData {
  id: string
  email: string
  tier: 'free' | 'pro' | 'admin'
  hasRecord: boolean
  is_active: boolean
  deactivated_at: string | null
  deactivation_reason: string | null
  created_at: string
  last_sign_in: string | null
  usage: {
    saved_properties_count: number
    saved_searches_count: number
    active_price_alerts_count: number
    property_views_today: number
  } | null
}

interface Stats {
  total_users: number
  admin_count: number
  pro_count: number
  free_count: number
  active_today: number
  deactivated_count: number
}

export default function AdminPortal() {
  const router = useRouter()
  const [users, setUsers] = useState<UserData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Modal states
  const [deactivateModal, setDeactivateModal] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null })
  const [tierModal, setTierModal] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null })
  const [deactivateReason, setDeactivateReason] = useState("")
  const [tierChoice, setTierChoice] = useState<string>("pro")
  const [tierReason, setTierReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  async function checkAdminAccess() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    setCurrentUserId(user.id)

    // Check if user is admin
    const response = await fetch('/api/entitlements')
    if (response.ok) {
      const data = await response.json()
      if (data.isAdmin) {
        setIsAdmin(true)
        fetchUsers()
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges.",
          variant: "destructive"
        })
        router.push('/')
      }
    } else {
      router.push('/auth/login')
    }
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setStats(data.stats)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateUserTier(userId: string, newTier: 'free' | 'pro' | 'admin', reason?: string) {
    setActionLoading(true)
    try {
      const response = await csrfFetch(`/api/admin/users/${userId}/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier, reason })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Tier updated",
          description: data.unchanged
            ? "That account was already on this tier."
            : `Moved to ${newTier}.`,
        })
        // The change is recorded, but say so only when it actually was.
        if (data.auditRecorded === false) {
          toast({
            title: "Audit row not written",
            description: "The tier changed, but the change was not recorded.",
            variant: "destructive"
          })
        }
        setTierModal({ open: false, user: null })
        setTierReason("")
        fetchUsers()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update tier",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error updating tier:', error)
      toast({
        title: "Error",
        description: "Failed to update tier",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function toggleAccountStatus(userId: string, activate: boolean, reason?: string) {
    setActionLoading(true)
    try {
      const response = await csrfFetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: activate, reason })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: activate ? "Account reactivated" : "Account deactivated",
        })
        setDeactivateModal({ open: false, user: null })
        setDeactivateReason("")
        fetchUsers()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to update account status",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: "Error",
        description: "Failed to update account status",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to App
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <h1 className="text-lg font-semibold text-slate-900">Admin Portal</h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
                <Users className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{stats.total_users}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Admins</CardTitle>
                <Crown className="w-4 h-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.admin_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Pro</CardTitle>
                <UserIcon className="w-4 h-4 text-teal-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-600">{stats.pro_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Active Today</CardTitle>
                <Activity className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active_today}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Deactivated</CardTitle>
                <UserX className="w-4 h-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.deactivated_count}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              All Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading users...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Credits Used</TableHead>
                    <TableHead>Saved</TableHead>
                    <TableHead>Alerts</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={!user.is_active ? 'opacity-60 bg-red-50' : ''}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <Ban className="w-3 h-3 mr-1" />
                            Deactivated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.tier === 'admin' ? (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                            <Crown className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : user.tier === 'pro' ? (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            Pro
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.usage ? (
                          <span>{user.usage.property_views_today}</span>
                        ) : (
                          // No record is an unknown, not a zero.
                          <span className="text-slate-400">no record</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.usage?.saved_properties_count ?? 0}
                      </TableCell>
                      <TableCell>
                        {user.usage?.active_price_alerts_count ?? 0}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {user.last_sign_in
                          ? new Date(user.last_sign_in).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        {user.id !== currentUserId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setTierChoice(user.tier)
                                  setTierModal({ open: true, user })
                                }}
                              >
                                <Crown className="w-4 h-4 mr-2" />
                                Change tier
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuSeparator />

                              {user.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => setDeactivateModal({ open: true, user })}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Deactivate Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => toggleAccountStatus(user.id, true)}
                                  className="text-green-600 focus:text-green-600"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Reactivate Account
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Deactivate Account Modal */}
      <Dialog open={deactivateModal.open} onOpenChange={(open) => setDeactivateModal({ open, user: open ? deactivateModal.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              Deactivate Account
            </DialogTitle>
            <DialogDescription>
              This will deactivate the account for <strong>{deactivateModal.user?.email}</strong>.
              The user will be signed out and unable to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for deactivation (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for deactivation..."
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateModal({ open: false, user: null })}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deactivateModal.user && toggleAccountStatus(deactivateModal.user.id, false, deactivateReason)}
              disabled={actionLoading}
            >
              {actionLoading ? "Deactivating..." : "Deactivate Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change tier */}
      <Dialog
        open={tierModal.open}
        onOpenChange={(open) => setTierModal({ open, user: open ? tierModal.user : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Change tier
            </DialogTitle>
            <DialogDescription>
              Set what <strong>{tierModal.user?.email}</strong> may do.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tier">Tier</Label>
              <Select value={tierChoice} onValueChange={setTierChoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free — map, list, Article 4 and licence states</SelectItem>
                  <SelectItem value="pro">Pro — adds owner and contact data, and export</SelectItem>
                  <SelectItem value="admin">Admin — everything, plus this console</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier-reason">Reason (optional)</Label>
              <Textarea
                id="tier-reason"
                placeholder="Why is this changing?"
                value={tierReason}
                onChange={(e) => setTierReason(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Recorded against your account in the tier change log.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTierModal({ open: false, user: null })}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                tierModal.user &&
                updateUserTier(
                  tierModal.user.id,
                  tierChoice as 'free' | 'pro' | 'admin',
                  tierReason,
                )
              }
              disabled={actionLoading}
            >
              {actionLoading ? "Applying..." : "Change tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
