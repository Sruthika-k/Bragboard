import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFeed, fetchUsers, toggleReaction, reportShoutout, fetchMe, adminDeleteShoutout } from '../lib/api'
import { API_BASE_URL } from '../config'
import Comments from './Comments'
import { useToast } from './Toast'
import { PromptDialog } from './PromptDialog'
import { ConfirmDialog } from './ConfirmDialog'

export default function Feed({ department = 'all', senderId = null, taggedUserId = null, date = null, refreshKey = 0, scrollToId = null }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [me, setMe] = useState(null)
  const [openReactors, setOpenReactors] = useState({})
  const [openComments, setOpenComments] = useState({})
  const [openMenus, setOpenMenus] = useState({})
  const cardRefs = useRef({})
  const didScrollRef = useRef(false)
  const navigate = useNavigate()
  const stop = (e) => { e.stopPropagation() }
  const toast = useToast()
  const [reportingShoutoutId, setReportingShoutoutId] = useState(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [feedRes, usersRes, meRes] = await Promise.all([
          fetchFeed({ department }),
          users.length ? Promise.resolve({ data: users }) : fetchUsers().then((x) => ({ data: x })),
          fetchMe().catch(() => null),
        ])
        if (!mounted) return
        setItems(feedRes.items || [])
        if (!users.length) setUsers(usersRes.data || [])
        setMe(meRes)
      } catch (e) {
        if (!mounted) return
        setError('Failed to load feed')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, refreshKey])

  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])

  const handleToggle = async (id, type) => {
    try {
      const res = await toggleReaction({ shoutout_id: id, type })
      setItems((prev) => prev.map(it => {
        if (it.id !== id) return it
        const reactors = { like: [...(it.reactors?.like||[])], clap: [...(it.reactors?.clap||[])], star: [...(it.reactors?.star||[])] }
        if (me) {
          const key = type
          const exists = (reactors[key] || []).some(u => u.id === me.id)
          if (exists) {
            // Toggle off: remove from this reaction type
            reactors[key] = (reactors[key] || []).filter(u => u.id !== me.id)
          } else {
            // Ensure only one reaction type per user per shout-out
            reactors.like = (reactors.like || []).filter(u => u.id !== me.id)
            reactors.clap = (reactors.clap || []).filter(u => u.id !== me.id)
            reactors.star = (reactors.star || []).filter(u => u.id !== me.id)
            reactors[key] = [...(reactors[key] || []), { id: me.id, name: me.name, email: me.email, department: me.department, role: me.role }]
          }
        }
        return { ...it, reactions: res.counts, reactors }
      }))
    } catch (e) {
      // ignore
    }
  }

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (senderId && it.sender_id !== Number(senderId)) return false
      if (taggedUserId) {
        const recIds = (it.recipients || []).map(r => r.id)
        if (!recIds.includes(Number(taggedUserId))) return false
      }
      if (date) {
        try {
          const d = new Date(it.created_at)
          const yyyy = d.getFullYear()
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          const ymd = `${yyyy}-${mm}-${dd}`
          if (ymd !== date) return false
        } catch {}
      }
      return true
    })
  }, [items, senderId, taggedUserId, date])

  // Scroll to a particular shoutout only when explicitly requested
  useEffect(() => {
    if (!scrollToId) return
    if (didScrollRef.current) return

    const exists = filtered.some(item => item.id === scrollToId)
    if (!exists) return

    const el = cardRefs.current[scrollToId]
    if (!el) return

    didScrollRef.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('ring-2', 'ring-indigo-400')

    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-indigo-400')
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('sid')
        url.searchParams.delete('highlightComment')
        window.history.replaceState({}, '', url.toString())
      } catch {
        // ignore URL errors
      }
    }, 1500)
  }, [filtered.length, scrollToId])

  if (loading) return <div className="text-gray-500">Loading feed...</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!items.length) return <div className="text-gray-500">No shout-outs yet.</div>

  return (
    <div className="space-y-4 mx-auto max-w-3xl">
      {filtered.map(item => {
        const sender = userMap[item.sender_id]
        const recipients = (item.recipients || []).map(r => r.name).join(', ')
        const reactors = item.reactors || { like: [], clap: [], star: [] }
        const reacted = {
          like: me ? (reactors.like || []).some(u => u.id === me.id) : false,
          clap: me ? (reactors.clap || []).some(u => u.id === me.id) : false,
          star: me ? (reactors.star || []).some(u => u.id === me.id) : false,
        }
        const imageSrc = item.image_url
          ? item.image_url.startsWith('http')
            ? item.image_url
            : `${API_BASE_URL}${item.image_url}`
          : null
        return (
          <div
            key={item.id}
            ref={el => { if (el) cardRefs.current[item.id] = el }}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                  {sender?.name ? sender.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-sm text-gray-600">From</div>
                  <div className="font-medium text-gray-900">{sender ? sender.name : `User #${item.sender_id}`}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">{item.department || '—'}</span>
                {item.created_at && (
                  <span className="text-gray-500">{new Date(item.created_at).toLocaleString()}</span>
                )}
              </div>
            </div>

            {recipients && (
              <div className="mt-2 text-sm text-gray-700">
                <span className="text-gray-500">To</span> {recipients}
              </div>
            )}

            <div className="mt-3 text-gray-900">{item.message}</div>
            {imageSrc && (
              <div className="mt-3">
                <img
                  src={imageSrc}
                  alt="Shout-out attachment"
                  className="max-h-80 rounded-lg border border-gray-200 object-contain"
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 text-sm">
              {/* Like */}
              <div className="relative inline-flex items-center gap-1">
                <button onClick={(e)=>{stop(e); handleToggle(item.id, 'like')}} className={`px-2 py-1 rounded-md border transition-colors duration-150 ${reacted.like ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'}`}>👍 {item.reactions?.like ?? 0}</button>
                <button onClick={(e)=>{stop(e); setOpenReactors(p => ({ ...p, [`${item.id}-like`]: !p[`${item.id}-like`] }))}} className="px-1 py-1 rounded-md hover:bg-gray-100">▾</button>
                {openReactors[`${item.id}-like`] && (
                  <div className="absolute z-10 top-full mt-1 left-0 bg-white border border-gray-200 rounded-md shadow-md w-48">
                    <div className="px-2 py-1 text-xs text-gray-500 border-b">Liked by</div>
                    <div className="max-h-48 overflow-auto divide-y">
                      {(reactors.like || []).map(u => <div key={u.id} className="px-2 py-1 text-sm text-gray-800">{u.name}</div>)}
                      {(!reactors.like || reactors.like.length === 0) && <div className="px-2 py-2 text-sm text-gray-500">No likes yet</div>}
                    </div>
                  </div>
                )}
              </div>
              {/* Clap */}
              <div className="relative inline-flex items-center gap-1">
                <button onClick={(e)=>{stop(e); handleToggle(item.id, 'clap')}} className={`px-2 py-1 rounded-md border transition-colors duration-150 ${reacted.clap ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'}`}>👏 {item.reactions?.clap ?? 0}</button>
                <button onClick={(e)=>{stop(e); setOpenReactors(p => ({ ...p, [`${item.id}-clap`]: !p[`${item.id}-clap`] }))}} className="px-1 py-1 rounded-md hover:bg-gray-100">▾</button>
                {openReactors[`${item.id}-clap`] && (
                  <div className="absolute z-10 top-full mt-1 left-0 bg-white border border-gray-200 rounded-md shadow-md w-48">
                    <div className="px-2 py-1 text-xs text-gray-500 border-b">Clapped by</div>
                    <div className="max-h-48 overflow-auto divide-y">
                      {(reactors.clap || []).map(u => <div key={u.id} className="px-2 py-1 text-sm text-gray-800">{u.name}</div>)}
                      {(!reactors.clap || reactors.clap.length === 0) && <div className="px-2 py-2 text-sm text-gray-500">No claps yet</div>}
                    </div>
                  </div>
                )}
              </div>
              {/* Star */}
              <div className="relative inline-flex items-center gap-1">
                <button onClick={(e)=>{stop(e); handleToggle(item.id, 'star')}} className={`px-2 py-1 rounded-md border transition-colors duration-150 ${reacted.star ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'}`}>⭐ {item.reactions?.star ?? 0}</button>
                <button onClick={(e)=>{stop(e); setOpenReactors(p => ({ ...p, [`${item.id}-star`]: !p[`${item.id}-star`] }))}} className="px-1 py-1 rounded-md hover:bg-gray-100">▾</button>
                {openReactors[`${item.id}-star`] && (
                  <div className="absolute z-10 top-full mt-1 left-0 bg-white border border-gray-200 rounded-md shadow-md w-48">
                    <div className="px-2 py-1 text-xs text-gray-500 border-b">Starred by</div>
                    <div className="max-h-48 overflow-auto divide-y">
                      {(reactors.star || []).map(u => <div key={u.id} className="px-2 py-1 text-sm text-gray-800">{u.name}</div>)}
                      {(!reactors.star || reactors.star.length === 0) && <div className="px-2 py-2 text-sm text-gray-500">No stars yet</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-gray-500 ml-auto">💬 {item.comments_count ?? 0}</div>
              {/* Three-dot menu for actions */}
              <div className="relative ml-auto">
                <button onClick={(e)=>{stop(e); setOpenMenus(p => ({ ...p, [item.id]: !p[item.id] }))}} className="px-2 py-1 rounded-md hover:bg-gray-100">⋯</button>
                {openMenus[item.id] && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-md w-40 z-10">
                    {me?.role === 'admin' && (
                      <button
                        onClick={(e) => {
                          stop(e)
                          setConfirmDeleteId(item.id)
                          setOpenMenus(p => ({ ...p, [item.id]: false }))
                        }}
                        className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50"
                      >Delete</button>
                    )}
                    <button
                      onClick={(e) => {
                        stop(e)
                        setReportingShoutoutId(item.id)
                        setOpenMenus(p => ({ ...p, [item.id]: false }))
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >Report</button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={(e) => { stop(e); setOpenComments(p => ({ ...p, [item.id]: !p[item.id] })) }}
                className="text-sm text-indigo-600 hover:underline"
              >{openComments[item.id] ? 'Hide comments' : 'View comments'}</button>
              {openComments[item.id] && (
                <Comments shoutoutId={item.id} />
              )}
            </div>
          </div>
        )
      })}
      <PromptDialog
        open={reportingShoutoutId != null}
        title="Report shout-out"
        message="Please provide a brief reason for reporting this shout-out."
        placeholder="Enter report reason..."
        confirmText="Submit report"
        cancelText="Cancel"
        submitting={reportSubmitting}
        onCancel={() => {
          setReportingShoutoutId(null)
        }}
        onConfirm={async (reason) => {
          if (!reportingShoutoutId) return
          const trimmed = reason.trim()
          if (!trimmed) return
          try {
            setReportSubmitting(true)
            await reportShoutout({ shoutout_id: reportingShoutoutId, reason: trimmed })
            toast.showSuccess('Report submitted.')
          } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to submit report. Please try again.'
            toast.showError(msg)
          } finally {
            setReportSubmitting(false)
            setReportingShoutoutId(null)
          }
        }}
      />
      <ConfirmDialog
        open={confirmDeleteId != null}
        title="Delete shout-out"
        message="Are you sure? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        submitting={false}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (!confirmDeleteId) return
          try {
            await adminDeleteShoutout(confirmDeleteId)
            setItems(prev => prev.filter(x => x.id !== confirmDeleteId))
            toast.showSuccess('Shout-out deleted.')
          } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to delete shout-out.'
            toast.showError(msg)
          } finally {
            setConfirmDeleteId(null)
          }
        }}
      />
    </div>
  )
}
