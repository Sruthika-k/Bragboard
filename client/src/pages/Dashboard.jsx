import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PostModal from '../components/PostModal'
import Feed from '../components/Feed'

export default function Dashboard() {
  const navigate = useNavigate()
  const [dept, setDept] = useState('all')
  const [showPost, setShowPost] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/')
    }
  }, [navigate])

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

        <Feed department={dept} refreshKey={refreshKey} />
      </main>

      <PostModal
        open={showPost}
        onClose={() => setShowPost(false)}
        onPosted={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
