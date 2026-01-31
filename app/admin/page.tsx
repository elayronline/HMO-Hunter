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
  Coins
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"

interface UserData {
  id: string
  email: string
  role: 'admin' | 'standard_pro'
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
}

export default function AdminPortal() {
  const router = useRouter()
  const [users, setUsers] = useState<UserData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
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
    </div>
  )
}
