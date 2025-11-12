import { useEffect, useMemo, useState } from 'react'
import { fetchFeed, fetchUsers, toggleReaction, reportShoutout } from '../lib/api'
import Comments from './Comments'

export default function Feed({ department = 'all', refreshKey = 0 }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [feedRes, usersRes] = await Promise.all([
          fetchFeed({ department }),
          users.length ? Promise.resolve({ data: users }) : fetchUsers().then((x) => ({ data: x })),
        ])
        if (!mounted) return
        setItems(feedRes.items || [])
        if (!users.length) setUsers(usersRes.data || [])
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
      setItems((prev) => prev.map(it => it.id === id ? { ...it, reactions: res.counts } : it))
    } catch (e) {
      // ignore
    }
  }

  if (loading) return <div className="text-gray-500">Loading feed...</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!items.length) return <div className="text-gray-500">No shout-outs yet.</div>

  return (
    <div className="space-y-4">
      {items.map(item => {
        const sender = userMap[item.sender_id]
        const recipients = (item.recipients || []).map(r => r.name).join(', ')
        return (
          <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-600">From</div>
                <div className="font-medium text-gray-900">{sender ? sender.name : `User #${item.sender_id}`}</div>
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
            {item.image_url && (
              <div className="mt-3">
                <img alt="attachment" src={item.image_url} className="rounded-md max-h-64 object-cover" />
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 text-sm">
              <button onClick={() => handleToggle(item.id, 'like')} className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200">👍 {item.reactions?.like ?? 0}</button>
              <button onClick={() => handleToggle(item.id, 'clap')} className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200">👏 {item.reactions?.clap ?? 0}</button>
              <button onClick={() => handleToggle(item.id, 'star')} className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200">⭐ {item.reactions?.star ?? 0}</button>
              <div className="text-gray-500 ml-auto">💬 {item.comments_count ?? 0}</div>
              <button
                onClick={async () => {
                  const reason = window.prompt('Report reason?')
                  if (!reason) return
                  try { await reportShoutout({ shoutout_id: item.id, reason }) } catch {}
                }}
                className="px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-100"
              >Report</button>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-indigo-600 hover:underline">Comments</summary>
              <Comments shoutoutId={item.id} />
            </details>
          </div>
        )
      })}
    </div>
  )
}
