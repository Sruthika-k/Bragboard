import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  adminDeleteComment,
} from '../lib/api'
import { fetchComments } from '../lib/api'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'

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
  const location = useLocation()
  const params = new URLSearchParams(location.search || '')
  const initialTab = params.get('tab') || 'overview'
  const initialReportId = params.get('reportId')
  const [me, setMe] = useState(null)
  const [tab, setTab] = useState(initialTab)

  // Data buckets
  const [users, setUsers] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [reports, setReports] = useState([])
  const [openComments, setOpenComments] = useState({})
  const [commentsByShoutout, setCommentsByShoutout] = useState({})
  const [analytics, setAnalytics] = useState({ top_contributors: [], most_tagged: [], active_departments: [] })

  const reportIdToFocusRef = useRef(initialReportId)
  const didScrollToReportRef = useRef(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const [confirmState, setConfirmState] = useState({ open: false, type: null, targetId: null, extra: null })

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
    if (tab === 'users') loadUsers()
    if (tab === 'shoutouts') { loadShoutouts(); loadUsers() }
    if (tab === 'reports') { loadReports(); loadUsers() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, me])

  // After reports load, if a reportId was provided in the URL, scroll to and highlight that row once
  useEffect(() => {
    if (tab !== 'reports') return
    if (didScrollToReportRef.current) return
    const rid = reportIdToFocusRef.current
    if (!rid) return
    const el = document.getElementById(`report-${rid}`)
    if (!el) return
    didScrollToReportRef.current = true
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      // ignore scroll errors
    }
    el.classList.add('bg-yellow-50')
    setTimeout(() => {
      el.classList.remove('bg-yellow-50')
    }, 2000)
  }, [tab, reports])

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    navigate('/')
  }

  const maxCount = (arr) => arr.reduce((m, x) => Math.max(m, x.count), 0) || 1
  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])

  const renderContentWithMentions = (text) => {
    if (!text) return null
    const parts = String(text).split(/(@\S+)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span
            key={idx}
            className="px-1 rounded bg-blue-50 text-blue-700 font-medium"
          >
            {part}
          </span>
        )
      }
      return <span key={idx}>{part}</span>
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar selectedDept={'all'} onChangeDept={() => {}} onLogout={logout} />

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <TabButton active={tab==='overview'} onClick={() => setTab('overview')}>Overview</TabButton>
            <TabButton active={tab==='users'} onClick={() => setTab('users')}>Users</TabButton>
            <TabButton active={tab==='shoutouts'} onClick={() => setTab('shoutouts')}>Shout-outs</TabButton>
            <TabButton active={tab==='reports'} onClick={() => setTab('reports')}>Reports</TabButton>
            {/* Analytics tab removed; overview already shows analytics */}
          </div>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        {tab === 'overview' && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Top contributors</div>
              <div className="space-y-2">
                {analytics.top_contributors.map((x) => (
                  <div key={x.user_id} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-semibold">
                      {(userMap[x.user_id]?.name || 'U').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-700 min-w-28">{userMap[x.user_id]?.name || 'Unknown User'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${(x.count / maxCount(analytics.top_contributors))*100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Most tagged</div>
              <div className="space-y-2">
                {analytics.most_tagged.map((x) => (
                  <div key={x.user_id} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-semibold">
                      {(userMap[x.user_id]?.name || 'U').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-700 min-w-28">{userMap[x.user_id]?.name || 'Unknown User'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${(x.count / maxCount(analytics.most_tagged))*100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-500 mb-1">Active departments</div>
              <div className="space-y-2">
                {analytics.active_departments.map((x) => (
                  <div key={x.department} className="flex items-center gap-2">
                    <div className="text-sm text-gray-700">{x.department || '—'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${(x.count / maxCount(analytics.active_departments))*100}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{x.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Users</div>
              <button onClick={loadUsers} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
            <div className="divide-y">
              {users.map((u, idx) => (
                <div key={u.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 text-gray-500">{idx + 1}.</div>
                  <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                    {u.name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}
                  </div>
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
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Shout-outs</div>
              <button onClick={loadShoutouts} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
            <div className="divide-y">
              {shoutouts.map((s, idx) => (
                <div key={s.id} className="flex flex-col gap-2 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 text-gray-500">{idx + 1}.</div>
                    <div className="flex-1">
                      <div className="text-gray-900">{s.message}</div>
                      <div className="text-gray-500">Sender: {userMap[s.sender_id]?.name || 'Unknown User'} · Dept: {s.department || '—'}</div>
                    </div>
                    <button onClick={() => navigate(`/dashboard?sid=${s.id}`)} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-200">View</button>
                    <button
                      onClick={() => setConfirmState({ open: true, type: 'shoutout', targetId: s.id, extra: null })}
                      className="px-3 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                    >Delete</button>
                  </div>
                  {/* Inline comments management */}
                  <div className="pl-10">
                    <button
                      onClick={async () => {
                        setOpenComments(p => ({ ...p, [s.id]: !p[s.id] }))
                        if (!commentsByShoutout[s.id]) {
                          try { const res = await fetchComments(s.id); setCommentsByShoutout(p => ({ ...p, [s.id]: res.items || [] })) } catch {}
                        }
                      }}
                      className="text-indigo-600 hover:underline"
                    >{openComments[s.id] ? 'Hide comments' : 'Manage comments'}</button>
                    {openComments[s.id] && (
                      <div className="mt-2 space-y-2">
                        {(commentsByShoutout[s.id] || []).map((c, i) => (
                          <div key={c.id} className="flex items-start gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-semibold">
                              {(c.user?.name || 'U').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm text-gray-900 truncate">{c.user?.name || 'User'}</div>
                                {c.created_at && <div className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</div>}
                              </div>
                              <div className="text-sm text-gray-700 break-words">{renderContentWithMentions(c.content)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => navigate(`/dashboard?sid=${s.id}`)} className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 border">View</button>
                              <button
                                onClick={() => setConfirmState({ open: true, type: 'comment', targetId: c.id, extra: { shoutoutId: s.id } })}
                                className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                              >Delete</button>
                            </div>
                          </div>
                        ))}
                        {(!commentsByShoutout[s.id] || commentsByShoutout[s.id].length === 0) && (
                          <div className="text-sm text-gray-500">No comments.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Reports</div>
              <button onClick={loadReports} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Refresh</button>
            </div>
            <div className="divide-y">
              {reports.map((r, idx) => (
                <div id={`report-${r.id}`} key={r.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 text-gray-500">{idx + 1}.</div>
                  <div className="flex-1">
                    <div className="text-gray-900">Reason: {r.reason}</div>
                    <div className="text-gray-500">Shoutout: {r.shoutout_id || '—'} · Comment: {r.comment_id || '—'} · Reporter: {userMap[r.reported_by]?.name || 'Unknown User'} · Reported: {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (r.comment_id && r.shoutout_id) {
                          navigate(`/dashboard?sid=${r.shoutout_id}&highlightComment=${r.comment_id}`)
                        } else if (r.shoutout_id) {
                          navigate(`/dashboard?sid=${r.shoutout_id}`)
                        }
                      }}
                      className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-200"
                    >View</button>
                    {r.comment_id ? (
                      <button
                        onClick={() => setConfirmState({ open: true, type: 'report-comment', targetId: r.comment_id, extra: { reportId: r.id } })}
                        className="px-3 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                      >Resolve</button>
                    ) : (
                      r.shoutout_id && (
                        <button
                          onClick={() => setConfirmState({ open: true, type: 'report-shoutout', targetId: r.shoutout_id, extra: { reportId: r.id } })}
                          className="px-3 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                        >Resolve</button>
                      )
                    )}
                    <button
                      onClick={() => setConfirmState({ open: true, type: 'report-dismiss', targetId: r.id, extra: null })}
                      className="px-3 py-1.5 rounded-md bg-gray-100 border border-gray-200 hover:bg-gray-200"
                    >Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <ConfirmDialog
        open={confirmState.open}
        title="Confirm action"
        message={
          confirmState.type && confirmState.type.startsWith('report-')
            ? 'Are you sure you want to perform this action?'
            : 'Are you sure? This action cannot be undone.'
        }
        confirmText={confirmState.type === 'report-dismiss' ? 'Dismiss' : 'Delete'}
        cancelText="Cancel"
        submitting={false}
        onCancel={() => setConfirmState({ open: false, type: null, targetId: null, extra: null })}
        onConfirm={async () => {
          if (!confirmState.type || !confirmState.targetId) {
            setConfirmState({ open: false, type: null, targetId: null, extra: null })
            return
          }
          try {
            if (confirmState.type === 'shoutout') {
              await adminDeleteShoutout(confirmState.targetId)
              setShoutouts(prev => prev.filter(x => x.id !== confirmState.targetId))
              toast.showSuccess('Shout-out deleted')
            } else if (confirmState.type === 'comment') {
              await adminDeleteComment(confirmState.targetId)
              const sid = confirmState.extra?.shoutoutId
              if (sid) {
                setCommentsByShoutout(p => ({ ...p, [sid]: (p[sid] || []).filter(x => x.id !== confirmState.targetId) }))
              }
              toast.showSuccess('Comment deleted')
            } else if (confirmState.type === 'report-comment') {
              await adminDeleteComment(confirmState.targetId)
              const rid = confirmState.extra?.reportId
              if (rid) {
                setReports(prev => prev.filter(x => x.id !== rid))
              }
              toast.showSuccess('Comment deleted')
            } else if (confirmState.type === 'report-shoutout') {
              await adminDeleteShoutout(confirmState.targetId)
              const rid = confirmState.extra?.reportId
              if (rid) {
                setReports(prev => prev.filter(x => x.id !== rid))
              }
              toast.showSuccess('Shout-out deleted')
            } else if (confirmState.type === 'report-dismiss') {
              const rid = confirmState.targetId
              const res = await adminDismissReport(rid)
              setReports(prev => prev.filter(x => x.id !== rid))
              toast.showSuccess(res?.message || 'Report dismissed')
            }
          } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to delete item.'
            toast.showError(msg)
          } finally {
            setConfirmState({ open: false, type: null, targetId: null, extra: null })
          }
        }}
      />
    </div>
  )
}
