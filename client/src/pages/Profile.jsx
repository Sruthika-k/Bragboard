import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { fetchMe, fetchUsers } from '../lib/api'

export default function Profile() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (id) {
          const list = await fetchUsers()
          if (!mounted) return
          const found = (list || []).find(u => String(u.id) === String(id))
          setUser(found || null)
        } else {
          const info = await fetchMe()
          if (!mounted) return
          setUser(info)
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar selectedDept={'all'} onChangeDept={() => {}} onLogout={() => {}} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-semibold">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900">{user?.name || 'User'}</div>
              <div className="text-sm text-gray-500">{user?.department || '—'} · {user?.email || ''}</div>
            </div>
          </div>
          {/* Bio temporarily hidden */}
        </div>
      </main>
    </div>
  )
}
