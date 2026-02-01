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
  Coins,
  Ban,
  CheckCircle,
  Plus,
  RotateCcw,
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
import { Input } from "@/components/ui/input"
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

interface UserData {
  id: string
  email: string
  role: 'admin' | 'standard_pro'
  is_active: boolean
  deactivated_at: string | null
  deactivation_reason: string | null
  created_at: string
  last_sign_in: string | null
  credits: {
    daily_credits: number
    credits_used: number
    saved_properties_count: number
    saved_searches_count: number
    active_price_alerts_count: number
  } | null
}

interface Stats {
  total_users: number
  admin_count: number
  standard_pro_count: number
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
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null })
  const [deactivateReason, setDeactivateReason] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [creditType, setCreditType] = useState<string>("reset")
  const [creditReason, setCreditReason] = useState("")
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
    const response = await fetch('/api/credits')
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

  async function updateUserRole(userId: string, newRole: 'admin' | 'standard_pro') {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `User role updated to ${newRole}`,
        })
        fetchUsers()
      } else {
        toast({
          title: "Error",
          description: "Failed to update user role",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  async function toggleAccountStatus(userId: string, activate: boolean, reason?: string) {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
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

  async function adjustCredits(userId: string) {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment_type: creditType,
          amount: creditType === 'reset' ? 0 : parseInt(creditAmount),
          reason: creditReason
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: `Credits adjusted successfully`,
        })
        setCreditsModal({ open: false, user: null })
        setCreditAmount("")
        setCreditType("reset")
        setCreditReason("")
        fetchUsers()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to adjust credits",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error adjusting credits:', error)
      toast({
        title: "Error",
        description: "Failed to adjust credits",
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Checking admin access...</p>
        </div>
      </div>
    )
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
                <CardTitle className="text-sm font-medium text-slate-600">Standard Pro</CardTitle>
                <UserIcon className="w-4 h-4 text-teal-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-600">{stats.standard_pro_count}</div>
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
                        {user.role === 'admin' ? (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                            <Crown className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Standard Pro
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.credits ? (
                          <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-slate-400" />
                            <span>{user.credits.credits_used} / {user.credits.daily_credits}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.credits?.saved_properties_count ?? 0}
                      </TableCell>
                      <TableCell>
                        {user.credits?.active_price_alerts_count ?? 0}
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
                              {user.role === 'standard_pro' ? (
                                <DropdownMenuItem
                                  onClick={() => updateUserRole(user.id, 'admin')}
                                >
                                  <Crown className="w-4 h-4 mr-2" />
                                  Make Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => updateUserRole(user.id, 'standard_pro')}
                                >
                                  <UserIcon className="w-4 h-4 mr-2" />
                                  Remove Admin
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setCreditsModal({ open: true, user })}
                              >
                                <Coins className="w-4 h-4 mr-2" />
                                Adjust Credits
                              </DropdownMenuItem>

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

      {/* Adjust Credits Modal */}
      <Dialog open={creditsModal.open} onOpenChange={(open) => setCreditsModal({ open, user: open ? creditsModal.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              Adjust Credits
            </DialogTitle>
            <DialogDescription>
              Adjust credits for <strong>{creditsModal.user?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {creditsModal.user?.credits && (
              <div className="bg-slate-100 p-3 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Current Usage:</span>
                  <span className="font-medium">{creditsModal.user.credits.credits_used} / {creditsModal.user.credits.daily_credits}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Adjustment Type</Label>
              <Select value={creditType} onValueChange={setCreditType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reset">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" />
                      Reset Usage to 0
                    </div>
                  </SelectItem>
                  <SelectItem value="bonus">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Give Bonus Credits
                    </div>
                  </SelectItem>
                  <SelectItem value="top_up">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      Increase Daily Limit
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {creditType !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="credit-reason">Reason (optional)</Label>
              <Textarea
                id="credit-reason"
                placeholder="Enter reason for adjustment..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreditsModal({ open: false, user: null })}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => creditsModal.user && adjustCredits(creditsModal.user.id)}
              disabled={actionLoading || (creditType !== 'reset' && !creditAmount)}
            >
              {actionLoading ? "Applying..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
