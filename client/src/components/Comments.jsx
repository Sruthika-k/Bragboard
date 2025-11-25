import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addComment, fetchComments, reportComment, fetchUsers } from '../lib/api'
import { fetchMe, adminDeleteComment } from '../lib/api'
import { useToast } from './Toast'
import { PromptDialog } from './PromptDialog'
import { ConfirmDialog } from './ConfirmDialog'

export default function Comments({ shoutoutId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [users, setUsers] = useState([])
  const [openSuggest, setOpenSuggest] = useState(false)
  const [filtered, setFiltered] = useState([])
  const [me, setMe] = useState(null)
  const [openMenus, setOpenMenus] = useState({})
  const [reportingCommentId, setReportingCommentId] = useState(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const toast = useToast()

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetchComments(shoutoutId)
      setItems(res.items || [])
    } catch (e) {
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoutoutId])

  useEffect(() => {
    let mounted = true
    async function loadUsers() {
      try {
        const [list, meRes] = await Promise.all([
          fetchUsers(),
          fetchMe().catch(() => null),
        ])
        if (mounted) {
          setUsers(list || [])
          setMe(meRes)
        }
      } catch {}
    }
    loadUsers()
    return () => { mounted = false }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      const msg = 'Comment cannot be empty.'
      setError(msg)
      toast.showError(msg)
      return
    }
    try {
      setPosting(true)
      await addComment({ shoutout_id: shoutoutId, content: trimmed })
      setText('')
      await load()
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to post comment. Please try again.'
      setError(msg)
      toast.showError(msg)
    } finally {
      setPosting(false)
    }
  }

  const onChangeText = (val) => {
    setText(val)
    const match = /(^|\s)@(\w*)$/.exec(val.slice(0))
    if (match) {
      const q = match[2].toLowerCase()
      const list = users.filter(u => u.name?.toLowerCase().includes(q))
      setFiltered(list.slice(0, 8))
      setOpenSuggest(list.length > 0)
    } else {
      setOpenSuggest(false)
    }
  }

  const insertMention = (user) => {
    const idx = text.lastIndexOf('@')
    if (idx >= 0) {
      const before = text.slice(0, idx)
      const after = text.slice(idx).replace(/^@\w*/, '')
      const next = `${before}@${user.name}${after} `
      setText(next)
    }
    setOpenSuggest(false)
  }

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
    <div className="mt-3 border-t pt-3">
      <form onSubmit={submit} className="mb-3">
        <div className="relative flex items-center gap-2">
          <input
            className="flex-1 px-3 py-2 border rounded-md"
            placeholder="Add a comment... Use @ to mention"
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
          />
          <button disabled={posting} className="px-3 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-60">
            {posting ? 'Posting...' : 'Post'}
          </button>
          {openSuggest && (
            <div className="absolute left-0 right-28 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-md z-10 max-h-56 overflow-auto">
              {filtered.map(u => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => insertMention(u)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  {u.name} <span className="text-gray-400">{u.department ? `· ${u.department}` : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      {loading && <div className="text-gray-500 text-sm">Loading comments...</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && !items.length && <div className="text-gray-500 text-sm">No comments yet.</div>}
      <div className="space-y-3">
        {items.map(c => (
          <div key={c.id} className="text-sm">
            <div className="flex items-start gap-2">
              {/* Initials avatar */}
              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                {c.user?.name ? c.user.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {c.user ? (
                    <Link to={`/profile/${c.user.id}`} className="font-medium text-gray-900 hover:underline truncate">{c.user.name}</Link>
                  ) : (
                    <span className="font-medium text-gray-900">User</span>
                  )}
                  {c.created_at && <span className="text-gray-400">{new Date(c.created_at).toLocaleString()}</span>}
                  <div className="relative ml-auto">
                    <button onClick={() => setOpenMenus(p => ({ ...p, [c.id]: !p[c.id] }))} className="px-2 py-1 rounded-md hover:bg-gray-100">⋯</button>
                    {openMenus[c.id] && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-md w-40 z-10">
                        {me?.role === 'admin' && (
                          <button
                            onClick={() => {
                              setConfirmDeleteId(c.id)
                              setOpenMenus(p => ({ ...p, [c.id]: false }))
                            }}
                            className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50"
                          >Delete</button>
                        )}
                        <button
                          onClick={() => {
                            setReportingCommentId(c.id)
                            setOpenMenus(p => ({ ...p, [c.id]: false }))
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >Report</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-gray-800 break-words">{renderContentWithMentions(c.content)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <PromptDialog
        open={reportingCommentId != null}
        title="Report comment"
        message="Please provide a brief reason for reporting this comment."
        placeholder="Enter report reason..."
        confirmText="Submit report"
        cancelText="Cancel"
        submitting={reportSubmitting}
        onCancel={() => {
          setReportingCommentId(null)
        }}
        onConfirm={async (reason) => {
          if (!reportingCommentId) return
          const trimmed = reason.trim()
          if (!trimmed) return
          try {
            setReportSubmitting(true)
            await reportComment({ comment_id: reportingCommentId, reason: trimmed })
            toast.showSuccess('Report submitted.')
          } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to submit report. Please try again.'
            setError(msg)
            toast.showError(msg)
          } finally {
            setReportSubmitting(false)
            setReportingCommentId(null)
          }
        }}
      />
      <ConfirmDialog
        open={confirmDeleteId != null}
        title="Delete comment"
        message="Are you sure? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        submitting={false}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (!confirmDeleteId) return
          try {
            await adminDeleteComment(confirmDeleteId)
            await load()
          } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to delete comment.'
            setError(msg)
            toast.showError(msg)
          } finally {
            setConfirmDeleteId(null)
          }
        }}
      />
    </div>
  )
}
