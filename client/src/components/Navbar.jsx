import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchDepartments, fetchMe, fetchFeed, fetchUsers } from '../lib/api'

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
          const tagged = recIds.includes(me.id)
          const reactedToMine = it.sender_id === me.id && anyReactor.some(u => u.id !== me.id)
          const commentedOnMine = it.sender_id === me.id && (it.comments_count || 0) > 0
          return tagged || reactedToMine || commentedOnMine
        }).slice(0, 5)
        setNotifs(filtered)
        // Determine if there are new notifications since last seen
        const newestTs = Math.max(0, ...filtered.map(it => it.created_at ? Date.parse(it.created_at) : 0))
        if (newestTs && newestTs > lastSeenAt) setHasNew(true)
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

  // Helper to build friendly notification text based on current user context
  const friendlyNotif = (item) => {
    try {
      const reactors = item.reactors || { like: [], clap: [], star: [] }
      const senderId = item.sender_id
      const recips = (item.recipients || []).map(r => r.id)
      if (me) {
        if (recips.includes(me.id)) return 'You were tagged in a shoutout.'
        if (senderId === me.id) {
          // Prefer showing reaction or comment activity on your post
          const allReactors = [...(reactors.like||[]), ...(reactors.clap||[]), ...(reactors.star||[])]
          const other = allReactors.find(u => u.id !== me.id)
          if (other) return `${other.name} reacted to your post.`
          if ((item.comments_count || 0) > 0) return 'Someone commented on your shoutout.'
        }
      }
      // Fallback
      return `New shoutout from ${item.sender_id ? `User #${item.sender_id}` : 'someone'}.`
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

        <div className="relative flex items-center gap-3">
          {/* Notifications */}
          <button onClick={() => { 
              setOpenNotif(o => !o)
              if (!openNotif) {
                const now = Date.now()
                setHasNew(false)
                setLastSeenAt(now)
                const key = me ? `notif_last_seen_${me.id}` : 'notif_last_seen'
                try { localStorage.setItem(key, String(now)) } catch {}
              }
            }} className="relative px-2 py-1.5 rounded-md hover:bg-gray-100" title="Notifications">
            <span>🔔</span>
            {hasNew && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-red-500 rounded-full" />}
          </button>
          {openNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <div className="px-3 py-2 border-b text-sm font-medium">Notifications</div>
              <div className="max-h-80 overflow-auto divide-y">
                {notifs.length === 0 && <div className="p-3 text-sm text-gray-500">No recent activity</div>}
                {notifs.map(n => (
                  <button key={n.id || Math.random()} onClick={() => { setOpenNotif(false); n?.id ? navigate(`/dashboard?sid=${n.id}`) : navigate('/dashboard') }} className="w-full text-left p-3 hover:bg-gray-50">
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
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 line-clamp-2">{friendlyNotif(n)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{timeAgo(n.created_at)}</div>
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
                  <div className="text-xs text-gray-500">{me.department || '—'}</div>
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
