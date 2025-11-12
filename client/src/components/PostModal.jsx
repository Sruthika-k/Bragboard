import { useEffect, useState } from 'react'
import { createShoutout, fetchDepartments, fetchUsers } from '../lib/api'

export default function PostModal({ open, onClose, onPosted }) {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    recipient_ids: [],
    department: '',
    message: '',
    image_url: '',
  })

  useEffect(() => {
    if (!open) return
    let mounted = true
    async function load() {
      try {
        const [u, d] = await Promise.all([fetchUsers(), fetchDepartments()])
        if (!mounted) return
        setUsers(u)
        setDepartments(d.departments || [])
      } catch (e) {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [open])

  const toggleRecipient = (id) => {
    setForm((p) => {
      const exists = p.recipient_ids.includes(id)
      return { ...p, recipient_ids: exists ? p.recipient_ids.filter(x => x !== id) : [...p.recipient_ids, id] }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.message.trim()) { setError('Please enter a message.'); return }
    try {
      setLoading(true)
      await createShoutout({
        message: form.message,
        department: form.department || undefined,
        recipient_ids: form.recipient_ids,
        image_url: form.image_url || undefined,
      })
      onPosted?.()
      onClose?.()
      setForm({ recipient_ids: [], department: '', message: '', image_url: '' })
    } catch (e) {
      setError('Failed to post. Check your connection and login.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold">Create Shout-out</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div>
            <label className="block text-sm text-gray-600 mb-1">Recipients</label>
            <div className="max-h-28 overflow-auto border rounded-md divide-y">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" checked={form.recipient_ids.includes(u.id)} onChange={() => toggleRecipient(u.id)} />
                  <span>{u.name} <span className="text-gray-400">({u.department || '—'})</span></span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Department</label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={form.department}
              onChange={(e) => setForm(p => ({ ...p, department: e.target.value }))}
            >
              <option value="">Auto (yours)</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Message</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md"
              rows={4}
              value={form.message}
              onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Write a recognition message..."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Image URL (optional)</label>
            <input
              className="w-full px-3 py-2 border rounded-md"
              value={form.image_url}
              onChange={(e) => setForm(p => ({ ...p, image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Cancel</button>
            <button disabled={loading} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              {loading ? 'Posting...' : 'Post Shout-out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
