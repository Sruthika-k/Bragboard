import { useEffect, useState } from 'react'
import { createShoutout, createShoutoutWithImage, fetchUsers, fetchMe } from '../lib/api'
import { useToast } from './Toast'

export default function PostModal({ open, onClose, onPosted }) {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([]) // no longer shown; kept to minimize changes
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [me, setMe] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imageName, setImageName] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const toast = useToast()

  const [form, setForm] = useState({
    recipient_ids: [],
    message: '',
  })
  const [recipientSearch, setRecipientSearch] = useState('')

  useEffect(() => {
    if (!open) return
    let mounted = true
    async function load() {
      try {
        const [u, meRes] = await Promise.all([fetchUsers(), fetchMe().catch(()=>null)])
        if (!mounted) return
        setUsers(u)
        setMe(meRes)
        setDepartments([])
      } catch (e) {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [open])

  const toggleRecipient = (id) => {
    // Frontend guard: do not allow tagging yourself
    if (me && Number(id) === Number(me.id)) {
      toast.showError('You cannot tag yourself.')
      return
    }
    setForm((p) => {
      const exists = p.recipient_ids.includes(id)
      return { ...p, recipient_ids: exists ? p.recipient_ids.filter(x => x !== id) : [...p.recipient_ids, id] }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.message.trim()) {
      setError('Message cannot be blank.')
      toast.showError('Message cannot be blank.')
      return
    }
    if (!form.recipient_ids || form.recipient_ids.length === 0) {
      const msg = 'Please select at least one recipient before posting.'
      setError(msg)
      toast.showError(msg)
      return
    }
    if (me && (form.recipient_ids || []).some((id) => Number(id) === Number(me.id))) {
      const msg = 'You cannot tag yourself.'
      setError(msg)
      toast.showError(msg)
      return
    }
    try {
      setLoading(true)
      if (imageFile) {
        const fd = new FormData()
        fd.append('message', form.message)
        fd.append('recipient_ids', JSON.stringify(form.recipient_ids || []))
        fd.append('file', imageFile)
        await createShoutoutWithImage(fd)
      } else {
        await createShoutout({
          message: form.message,
          recipient_ids: form.recipient_ids,
        })
      }
      onPosted?.()
      onClose?.()
      setForm({ recipient_ids: [], message: '' })
      setImageFile(null)
      setImageName('')
      setImagePreviewUrl('')
      toast.showSuccess('Shout-out posted.')
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to post shout-out. Please try again.'
      setError(msg)
      toast.showError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between flex-none">
          <h3 className="font-semibold">Create Shout-out</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={submit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && <div className="text-sm text-red-600">{error}</div>}

            <div>
              <label className="block text-sm text-gray-600 mb-1">Recipients</label>
              <input
                type="text"
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                placeholder="Search by name or department..."
                className="mb-2 w-full px-3 py-2 border rounded-md text-sm"
              />
              <div className="max-h-64 overflow-auto border rounded-md divide-y">
                {(() => {
                  const myDept = me?.department || ''
                  const myId = me?.id
                  const q = recipientSearch.trim().toLowerCase()
                  const filtered = [...users].filter(u => {
                    if (myId && Number(u.id) === Number(myId)) return false
                    if (!q) return true
                    const name = (u.name || '').toLowerCase()
                    const dept = (u.department || '').toLowerCase()
                    return name.includes(q) || dept.includes(q)
                  })
                  const sorted = filtered.sort((a,b) => {
                    const aIn = (a.department||'') === myDept
                    const bIn = (b.department||'') === myDept
                    if (aIn !== bIn) return aIn ? -1 : 1
                    return (a.name||'').localeCompare(b.name||'')
                  })
                  return sorted.map(u => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <input type="checkbox" checked={form.recipient_ids.includes(u.id)} onChange={() => toggleRecipient(u.id)} />
                      <span>{u.name} <span className="text-gray-400">({u.department || '—'})</span></span>
                    </label>
                  ))
                })()}
              </div>
            </div>

            {/* Department selection removed; backend uses sender's department automatically */}

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
              <label className="block text-sm text-gray-600 mb-1">Image (optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={(e) => {
                  setError('')
                  const file = e.target.files && e.target.files[0]
                  if (!file) {
                    setImageFile(null)
                    setImageName('')
                    setImagePreviewUrl('')
                    return
                  }
                  const allowedTypes = ['image/jpeg', 'image/png']
                  if (!allowedTypes.includes(file.type)) {
                    const msg = 'Only JPG and PNG image files are allowed (max 5MB).'
                    setError(msg)
                    setImageFile(null)
                    setImageName('')
                    setImagePreviewUrl('')
                    toast.showError(msg)
                    return
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    const msg = 'Image file size too large (max 5MB).'
                    setError(msg)
                    setImageFile(null)
                    setImageName('')
                    setImagePreviewUrl('')
                    toast.showError(msg)
                    return
                  }
                  setImageFile(file)
                  setImageName(file.name || 'Selected image')
                  try {
                    const url = URL.createObjectURL(file)
                    setImagePreviewUrl(url)
                  } catch {
                    setImagePreviewUrl('')
                  }
                }}
                className="block w-full text-sm text-gray-700"
              />
              <p className="mt-1 text-xs text-gray-400">JPG or PNG, up to 5MB.</p>
              {imageFile && (
                <div className="mt-2 space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    <span className="truncate max-w-[180px]">{imageName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null)
                        setImageName('')
                        setImagePreviewUrl('')
                      }}
                      className="text-gray-500 hover:text-red-600 font-semibold"
                      aria-label="Remove attached image"
                    >
                      ✕
                    </button>
                  </div>
                  {imagePreviewUrl && (
                    <div className="mt-1">
                      <img
                        src={imagePreviewUrl}
                        alt="Image preview"
                        className="max-h-48 rounded-md border border-gray-200 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 pb-4 pt-2 border-t border-gray-100 flex items-center justify-end gap-2 flex-none bg-white">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button
                disabled={
                  loading ||
                  !form.recipient_ids.length
                }
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? 'Posting...' : 'Post Shout-out'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
