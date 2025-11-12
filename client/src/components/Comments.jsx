import { useEffect, useState } from 'react'
import { addComment, fetchComments, reportComment } from '../lib/api'

export default function Comments({ shoutoutId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

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

  return (
    <div className="mt-3 border-t pt-3">
      <form onSubmit={submit} className="flex items-center gap-2 mb-3">
        <input
          className="flex-1 px-3 py-2 border rounded-md"
          placeholder="Add a comment... Use @ to mention"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button disabled={posting} className="px-3 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-60">
          {posting ? 'Posting...' : 'Post'}
        </button>
      </form>

      {loading && <div className="text-gray-500 text-sm">Loading comments...</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && !items.length && <div className="text-gray-500 text-sm">No comments yet.</div>}
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{c.user?.name || 'User'}</span>
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
