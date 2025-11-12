import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDepartments, fetchMe } from '../lib/api'

export default function Navbar({ selectedDept, onChangeDept, onLogout }) {
  const [departments, setDepartments] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [deptRes, meRes] = await Promise.all([
          fetchDepartments(),
          fetchMe().catch(() => null),
        ])
        if (!mounted) return
        setDepartments(deptRes.departments || [])
        setMe(meRes)
      } catch (e) {
        // swallow; navbar should still render
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <div className="font-semibold text-indigo-600 text-lg">BragBoard</div>
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Department</label>
          <select
            className="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm"
            value={selectedDept}
            onChange={(e) => onChangeDept?.(e.target.value)}
          >
            <option value="all">All</option>
            <option value="mine">Mine</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <div className="flex items-center gap-3">
          {me ? (
            <>
              <div className="text-sm text-gray-700">
                <div className="font-medium">{me.name}</div>
                <div className="text-xs text-gray-500">{me.department || '—'}</div>
              </div>
              {me.role === 'admin' && (
                <Link to="/admin" className="text-sm px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">Admin</Link>
              )}
              <button
                onClick={onLogout}
                className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="text-xs text-gray-400">Not signed in</div>
          )}
        </div>
      </div>
    </header>
  )
}
