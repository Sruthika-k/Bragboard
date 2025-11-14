import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import {
  fetchMe,
  adminUsers,
  adminDeleteUser,
  adminShoutouts,
  adminDeleteShoutout,
  adminReports,
  adminDismissReport,
  adminAnalytics,
} from '../lib/api'

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm border ${active ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [tab, setTab] = useState('overview')

  // Data buckets
  const [users, setUsers] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [reports, setReports] = useState([])
  const [analytics, setAnalytics] = useState({ top_contributors: [], most_tagged: [], active_departments: [] })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function guard() {
      try {
        const info = await fetchMe()
        if (!mounted) return
        setMe(info)
        if (info.role !== 'admin') {
          navigate('/dashboard')
        }
      } catch {
        navigate('/')
      }
    }
    guard()
    return () => { mounted = false }
  }, [navigate])

  async function loadUsers() {
    setLoading(true); setError('')
    try { setUsers(await adminUsers()) } catch { setError('Failed to load users') } finally { setLoading(false) }
  }
  async function loadShoutouts() {
    setLoading(true); setError('')
    try { setShoutouts(await adminShoutouts()) } catch { setError('Failed to load shoutouts') } finally { setLoading(false) }
  }
  async function loadReports() {
    setLoading(true); setError('')
    try { setReports(await adminReports()) } catch { setError('Failed to load reports') } finally { setLoading(false) }
  }
  async function loadAnalytics() {
    setLoading(true); setError('')
    try { setAnalytics(await adminAnalytics()) } catch { setError('Failed to load analytics') } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!me || me.role !== 'admin') return
    if (tab === 'overview') { loadAnalytics(); loadUsers() }
    if (tab === 'analytics') { loadAnalytics(); loadUsers() }
    if (tab === 'users') loadUsers()
    if (tab === 'shoutouts') { loadShoutouts(); loadUsers() }
    if (tab === 'reports') { loadReports(); loadUsers() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, me])

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    navigate('/')
  }

  const maxCount = (arr) => arr.reduce((m, x) => Math.max(m, x.count), 0) || 1
  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar selectedDept={'all'} onChangeDept={() => {}} onLogout={logout} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <TabButton active={tab==='overview'} onClick={() => setTab('overview')}>Overview</TabButton>
            <TabButton active={tab==='users'} onClick={() => setTab('users')}>Users</TabButton>
            <TabButton active={tab==='shoutouts'} onClick={() => setTab('shoutouts')}>Shout-outs</TabButton>
            <TabButton active={tab==='reports'} onClick={() => setTab('reports')}>Reports</TabButton>
            <TabButton active={tab==='analytics'} onClick={() => setTab('analytics')}>Analytics</TabButton>
          </div>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        {tab === 'overview' && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white border">
              <div className="text-sm text-gray-500 mb-1">Top contributors</div>
              <div className="space-y-2">
                {analytics.top_contributors.map((x) => (
                  <div key={x.user_id} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{userMap[x.user_id]?.name || 'Unknown User'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded">
                      <div className="h-2 bg-indigo-500 rounded" style={{ width: `${(x.count / maxCount(analytics.top_contributors))*100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white border">
              <div className="text-sm text-gray-500 mb-1">Most tagged</div>
              <div className="space-y-2">
                {analytics.most_tagged.map((x) => (
                  <div key={x.user_id} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{userMap[x.user_id]?.name || 'Unknown User'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded">
                      <div className="h-2 bg-blue-500 rounded" style={{ width: `${(x.count / maxCount(analytics.most_tagged))*100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white border">
              <div className="text-sm text-gray-500 mb-1">Active departments</div>
              <div className="space-y-2">
                {analytics.active_departments.map((x) => (
                  <div key={x.department} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{x.department || '—'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded">
                      <div className="h-2 bg-emerald-500 rounded" style={{ width: `${(x.count / maxCount(analytics.active_departments))*100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white border rounded-lg">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Users</div>
              <button onClick={loadUsers} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
            <div className="divide-y">
              {users.map((u, idx) => (
                <div key={u.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 text-gray-500">{idx + 1}.</div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-gray-500">{u.email} · {u.department || '—'} · {u.role}</div>
                  </div>
                  {/* Admin no longer deletes users */}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'shoutouts' && (
          <div className="bg-white border rounded-lg">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Shout-outs</div>
              <button onClick={loadShoutouts} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
            <div className="divide-y">
              {shoutouts.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 text-gray-500">{idx + 1}.</div>
                  <div className="flex-1">
                    <div className="text-gray-900">{s.message}</div>
                    <div className="text-gray-500">Sender: {userMap[s.sender_id]?.name || 'Unknown User'} · Dept: {s.department || '—'}</div>
                  </div>
                  <button onClick={async () => { try { await adminDeleteShoutout(s.id); setShoutouts(prev => prev.filter(x => x.id !== s.id)) } catch {} }} className="px-3 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100">Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="bg-white border rounded-lg">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Reports</div>
              <button onClick={loadReports} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
            <div className="divide-y">
              {reports.map((r, idx) => (
                <div key={r.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 text-gray-500">{idx + 1}.</div>
                  <div className="flex-1">
                    <div className="text-gray-900">Reason: {r.reason}</div>
                    <div className="text-gray-500">Shoutout: {r.shoutout_id || '—'} · Comment: {r.comment_id || '—'} · Reporter: {userMap[r.reported_by]?.name || 'Unknown User'}</div>
                  </div>
                  <button onClick={async () => { try { const res = await adminDismissReport(r.id); alert(res?.message || 'Report Resolved'); setReports(prev => prev.filter(x => x.id !== r.id)) } catch {} }} className="px-3 py-1.5 rounded-md bg-gray-100 border border-gray-200 hover:bg-gray-200">Dismiss</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-white border">
              <div className="font-medium mb-2">Top contributors</div>
              <div className="space-y-2">
                {analytics.top_contributors.map(x => (
                  <div key={x.user_id} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{userMap[x.user_id]?.name || 'Unknown User'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-indigo-500 rounded" style={{ width: `${(x.count / maxCount(analytics.top_contributors))*100}%` }} /></div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white border">
              <div className="font-medium mb-2">Most tagged</div>
              <div className="space-y-2">
                {analytics.most_tagged.map(x => (
                  <div key={x.user_id} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{userMap[x.user_id]?.name || 'Unknown User'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-blue-500 rounded" style={{ width: `${(x.count / maxCount(analytics.most_tagged))*100}%` }} /></div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white border md:col-span-2">
              <div className="font-medium mb-2">Active departments</div>
              <div className="space-y-2">
                {analytics.active_departments.map(x => (
                  <div key={x.department} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{x.department || '—'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-emerald-500 rounded" style={{ width: `${(x.count / maxCount(analytics.active_departments))*100}%` }} /></div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
