import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchDepartments, fetchMe, fetchFeed, fetchUsers, adminNotifications, deleteNotification, markNotificationRead } from '../lib/api'

export default function Navbar({ selectedDept, onChangeDept, onLogout }) {
  const [departments, setDepartments] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openNotif, setOpenNotif] = useState(false)
  const [notifs, setNotifs] = useState([])
  const navigate = useNavigate()
  const location = useLocation()
  const [users, setUsers] = useState([])
  const [hasNew, setHasNew] = useState(false)
  const [lastSeenAt, setLastSeenAt] = useState(0)
  const notifRef = useRef(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [deptRes, meRes, userList] = await Promise.all([
          fetchDepartments(),
          fetchMe().catch(() => null),
          fetchUsers().catch(() => []),
        ])
        if (!mounted) return
        setDepartments(deptRes.departments || [])
        setMe(meRes)
        setUsers(userList || [])
      } catch (e) {
        // swallow; navbar should still render
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Load last seen timestamp from localStorage once the current user is known
  useEffect(() => {
    if (!me) return
    const key = `notif_last_seen_${me.id}`
    const stored = Number(localStorage.getItem(key) || 0)
    if (stored > 0) {
      setLastSeenAt(stored)
      setHasNew(false)
    }
  }, [me])

  const timeAgo = (iso) => {
    if (!iso) return ''
    const s = Math.floor((Date.now() - Date.parse(iso)) / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s/60); if (m < 60) return `${m}m ago`
    const h = Math.floor(m/60); if (h < 24) return `${h}h ago`
    const d = Math.floor(h/24); if (d === 1) return 'Yesterday'; return `${d}d ago`
  }

  const nameOf = (id) => users.find(u => u.id === id)?.name || `User #${id}`
  const initials = (name) => (name || 'U').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()

  // lightweight polling for notifications (recent items)
  useEffect(() => {
    let timer
    async function load() {
      try {
        const res = await fetchFeed({ department: 'all' })
        const raw = (res.items || [])
        // Filter to relevant items only for current user
        const filtered = raw.filter(it => {
          if (!me) return false
          const recIds = (it.recipients || []).map(r => r.id)
          const reactors = it.reactors || { like: [], clap: [], star: [] }
          const anyReactor = [...(reactors.like||[]), ...(reactors.clap||[]), ...(reactors.star||[])]
          const tagged = recIds.includes(me.id) && it.sender_id !== me.id
          const reactedToMine = it.sender_id === me.id && anyReactor.some(u => u.id !== me.id)
          const commentedOnMine = it.sender_id === me.id && (it.comments_count || 0) > 0
          const taggedInComments = Boolean(it.tagged_in_comments)
          return tagged || reactedToMine || commentedOnMine || taggedInComments
        }).slice(0, 5)
        // Attach explicit navigation targets for feed-based notifications
        let items = filtered.map(it => ({ ...it, target_type: 'shoutout', target_id: it.id }))

        // Admin-specific notifications: profile changes and reports
        if (me && me.role === 'admin') {
          try {
            const adminRes = await adminNotifications()
            const adminItems = (adminRes.items || [])
              // Exclude ONLY admin’s own profile updates
              .filter(x => !(x.type === 'user_change' && x.target_id === me.id))
              // Allow all types including "tag"
              .map((x) => ({ ...x, _admin: true }))
            // Merge then sort by timestamp descending
            items = [...adminItems, ...items]
              .filter(Boolean)
              .sort((a, b) => {
                const tA = a.created_at ? Date.parse(a.created_at) : 0
                const tB = b.created_at ? Date.parse(b.created_at) : 0
                return tB - tA
              })
          } catch {}
        }

        // Deduplicate notifications by logical key
        const seen = new Set()
        items = items.filter(it => {
          const key = it._admin ? `admin-${it.type}-${it.id}` : `feed-${it.id}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        setNotifs(items)
        // Determine if there are new notifications since last seen
        const newestTs = Math.max(0, ...items.map(it => it.created_at ? Date.parse(it.created_at) : 0))
        setHasNew(Boolean(newestTs && newestTs > lastSeenAt))
      } catch {}
    }
    load()
    timer = setInterval(load, 10000) // 10s
    return () => { if (timer) clearInterval(timer) }
  }, [me, lastSeenAt])

  // Recompute hasNew immediately when notifications or lastSeenAt change
  useEffect(() => {
    const newestTs = Math.max(0, ...notifs.map(it => it.created_at ? Date.parse(it.created_at) : 0))
    setHasNew(Boolean(newestTs && newestTs > lastSeenAt))
  }, [notifs, lastSeenAt])

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    if (!openNotif) return
    const handler = (e) => {
      if (!notifRef.current) return
      if (!notifRef.current.contains(e.target)) {
        setOpenNotif(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
    }
  }, [openNotif])

  // Helper to build friendly notification text based on current user context
  const friendlyNotif = (item) => {
    try {
      // Admin notifications
      if (item._admin) {
        if (item.type === 'tag') {
          return item.action || 'You were tagged in a shoutout.'
        }
        if (item.type === 'report') {
          return 'A new report has been filed.'
        }
        if (item.type === 'user_change') {
          // For user profile changes (including username updates), rely on target_type
          if (item.target_type === 'user') {
            // Backend already sets a descriptive action like "Username updated: <name>"
            return item.action || 'User profile updated.'
          }
          return 'User profile updated.'
        }
      }

      const reactors = item.reactors || { like: [], clap: [], star: [] }
      const senderId = item.sender_id
      const recips = (item.recipients || []).map(r => r.id)
      if (me) {
        if (recips.includes(me.id)) {
          const senderName = nameOf(senderId)
          return `${senderName} tagged you in a shoutout`
        }
        if (senderId === me.id) {
          // Prefer showing reaction or comment activity on your post
          const allReactors = [...(reactors.like||[]), ...(reactors.clap||[]), ...(reactors.star||[])]
          const other = allReactors.find(u => u.id !== me.id)
          if (other) return `${other.name} reacted to your post`
          if ((item.comments_count || 0) > 0) return 'Someone commented on your shoutout'
        }
      }
      // Fallback
      return `New shoutout from ${item.sender_id ? nameOf(item.sender_id) : 'someone'}`
    } catch {
      return 'New activity on BragBoard.'
    }
  }

  return (
    <header className="w-full bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <Link to="/dashboard" className="font-semibold text-indigo-600 text-lg">BragBoard</Link>
        <div className="flex-1" />

        {/* Feed and Admin Dashboard side-by-side depending on role */}
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className={`text-sm px-3 py-1.5 rounded-md border ${location.pathname.startsWith('/dashboard') ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`} title="Feed">Feed</Link>
          {me?.role === 'admin' && (
            <Link to="/admin" className={`text-sm px-3 py-1.5 rounded-md border ${location.pathname.startsWith('/admin') ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`} title="Dashboard">Dashboard</Link>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <div ref={notifRef} className="relative flex items-center gap-3">
          {/* Notifications */}
          <button
            onClick={() => {
              setOpenNotif((prev) => {
                const next = !prev
                if (next) {
                  // Mark all current notifications as seen when opening
                  const newestTs = Math.max(0, ...notifs.map(it => it.created_at ? Date.parse(it.created_at) : 0))
                  const seenAt = newestTs || Date.now()
                  setLastSeenAt(seenAt)
                  setHasNew(false)
                  const key = me ? `notif_last_seen_${me.id}` : 'notif_last_seen'
                  try { localStorage.setItem(key, String(seenAt)) } catch {}
                }
                return next
              })
            }}
            className="relative px-2 py-1.5 rounded-md hover:bg-gray-100"
            title="Notifications"
          >
            <span>🔔</span>
            {hasNew && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-red-500 rounded-full" />}
          </button>
          {openNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <div className="px-3 py-2 border-b text-sm font-medium">Notifications</div>
              <div className="max-h-80 overflow-auto divide-y">
                {notifs.length === 0 && <div className="p-3 text-sm text-gray-500">No recent activity</div>}
                {notifs.map(n => (
                  <button
                    key={n.id || Math.random()}
                    onClick={async () => {
                      if (n && n.id) {
                        try { await markNotificationRead(n.id) } catch (e) { console.error(e) }
                      }
                      setOpenNotif(false)
                      // Mark notifications as seen immediately on click
                      const seenAt = Date.now()
                      setLastSeenAt(seenAt)
                      setHasNew(false)
                      const key = me ? `notif_last_seen_${me.id}` : 'notif_last_seen'
                      try { localStorage.setItem(key, String(seenAt)) } catch {}
                      const tType = n.target_type
                      const tId = n.target_id || n.id
                      const currentUser = me

                      // Admins have strict routing rules and should not be sent to user profile pages
                      if (currentUser && currentUser.role === 'admin') {
                        const tt = tType
                        const tid = tId

                        if (tt === 'report' && tid) {
                          navigate(`/admin?tab=reports&reportId=${tid}`)
                          return
                        }
                        if (tt === 'shoutout' && tid) {
                          navigate(`/dashboard?sid=${tid}`)
                          return
                        }
                        if (tt === 'comment' && tid) {
                          const parent = n.shoutout_id || n.parent_shoutout_id
                          if (parent) {
                            navigate(`/dashboard?sid=${parent}&highlightComment=${tid}`)
                          } else {
                            navigate('/dashboard')
                          }
                          return
                        }
                        if (tt === 'user' && tid) {
                          navigate(`/admin?tab=users&userId=${tid}`)
                          return
                        }
                        // Fallback for any other admin notification
                        navigate('/admin')
                        return
                      }

                      // Non-admin users: primary navigation based on target_type/target_id
                      if (tType === 'shoutout' && tId) {
                        navigate(`/dashboard?sid=${tId}`)
                        return
                      }
                      if (tType === 'comment' && tId) {
                        const parent = n.shoutout_id || n.parent_shoutout_id
                        if (parent) {
                          navigate(`/dashboard?sid=${parent}&highlightComment=${tId}`)
                        } else {
                          navigate('/dashboard')
                        }
                        return
                      }
                      if (tType === 'report' && tId) {
                        // Non-admins seeing report notifications (if any) can fall back to dashboard
                        navigate('/dashboard')
                        return
                      }
                      if (tType === 'user' && tId) {
                        navigate(`/profile/${tId}`)
                        return
                      }

                      // Fallback for regular notifications without explicit target_type
                      if (tId) {
                        navigate(`/dashboard?sid=${tId}`)
                      } else {
                        navigate('/dashboard')
                      }
                    }}
                    className="w-full text-left p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                        {(() => {
                          // Choose avatar: reactor name if available, else sender name
                          const reactors = n.reactors || { like: [], clap: [], star: [] }
                          const other = [...(reactors.like||[]), ...(reactors.clap||[]), ...(reactors.star||[])].find(u => !me || u.id !== me.id)
                          const displayName = other?.name || nameOf(n.sender_id)
                          return initials(displayName)
                        })()}
                      </div>
                      <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm text-gray-900 line-clamp-2">{friendlyNotif(n)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{timeAgo(n.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {me ? (
            <>
              <Link to="/profile" className="text-sm text-gray-700 rounded-md px-2 py-1 hover:bg-gray-100 flex items-center gap-2" title="Profile">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                  {me.name ? me.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="font-medium">{me.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{me.department || '—'}</span>
                    {me.role === 'admin' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              {me.role === 'admin' && (
                <Link to="/admin" className="hidden" />
              )}
              <button
                onClick={onLogout}
                className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="text-xs text-gray-400">Not signed in</div>
          )}
        </div>
      </div>
    </header>
  )
}
