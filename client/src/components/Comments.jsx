import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addComment, fetchComments, reportComment, fetchUsers } from '../lib/api'

export default function Comments({ shoutoutId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [users, setUsers] = useState([])
  const [openSuggest, setOpenSuggest] = useState(false)
  const [filtered, setFiltered] = useState([])

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
        const list = await fetchUsers()
        if (mounted) setUsers(list || [])
      } catch {}
    }
    loadUsers()
    return () => { mounted = false }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    try {
      setPosting(true)
      await addComment({ shoutout_id: shoutoutId, content: text })
      setText('')
      await load()
    } catch (e) {
      // swallow
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
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="text-sm">
            <div className="flex items-center gap-2">
              {c.user ? (
                <Link to={`/profile/${c.user.id}`} className="font-medium text-gray-900 hover:underline">{c.user.name}</Link>
              ) : (
                <span className="font-medium text-gray-900">User</span>
              )}
              {c.created_at && <span className="text-gray-400">{new Date(c.created_at).toLocaleString()}</span>}
              <button
                onClick={async () => {
                  const reason = window.prompt('Report comment reason?')
                  if (!reason) return
                  try { await reportComment({ comment_id: c.id, reason }) } catch {}
                }}
                className="ml-auto px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-100"
              >Report</button>
            </div>
            <div className="text-gray-800">{c.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
