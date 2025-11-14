import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PostModal from '../components/PostModal'
import Feed from '../components/Feed'
import { fetchUsers, fetchDepartments } from '../lib/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [dept, setDept] = useState('all')
  const [senderId, setSenderId] = useState('')
  const [date, setDate] = useState('')
  const [departments, setDepartments] = useState([])
  const [showPost, setShowPost] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [senders, setSenders] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/')
    }
  }, [navigate])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [list, deptRes] = await Promise.all([fetchUsers(), fetchDepartments()])
        if (mounted) {
          setSenders(list || [])
          setDepartments(deptRes.departments || [])
        }
      } catch {}
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar selectedDept={dept} onChangeDept={setDept} onLogout={handleLogout} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <button onClick={() => setShowPost(true)} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">New Shout-out</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Department</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-white"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="all">All</option>
              <option value="mine">Mine</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sender</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-white"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
            >
              <option value="">All</option>
              {senders.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-md"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <Feed department={dept} senderId={senderId} date={date} refreshKey={refreshKey} />
      </main>

      <PostModal
        open={showPost}
        onClose={() => setShowPost(false)}
        onPosted={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
