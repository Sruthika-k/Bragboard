import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Feed from '../components/Feed'
import { fetchMe, fetchUsers, fetchDepartments, updateMe } from '../lib/api'
import { isStrongPassword } from '../lib/validation'
import { useToast } from '../components/Toast'

export default function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([]) // retained for display; no edit UI
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [pwdDraft, setPwdDraft] = useState({ current: '', next: '', confirm: '' })
  const [showSuccess, setShowSuccess] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false })
  const toast = useToast()

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [meInfo, deptRes] = await Promise.all([
          fetchMe().catch(() => null),
          fetchDepartments().catch(() => ({ departments: [] })),
        ])
        if (!mounted) return
        setMe(meInfo)
        setDepartments(deptRes.departments || [])
        if (id) {
          const list = await fetchUsers()
          if (!mounted) return
          const found = (list || []).find(u => String(u.id) === String(id))
          setUser(found || null)
        } else {
          setUser(meInfo)
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

  const canEdit = useMemo(() => {
    if (!user || !me) return false
    return !id || String(me.id) === String(id)
  }, [user, me, id])

  const [form, setForm] = useState({ name: '', password: '' })
  useEffect(() => {
    if (!user) return
    setForm({
      name: user.name || '',
      password: ''
    })
  }, [user])

  const openNameModal = () => { if (!canEdit) return; setNameDraft(form.name); setShowNameModal(true) }
  const saveName = async () => {
    const next = nameDraft.trim()
    if (!next || next === form.name) { setShowNameModal(false); return }
    setMsg('')
    try {
      setSaving(true)
      await updateMe({ name: next })
      setForm(p => ({ ...p, name: next }))
      setMsg('Profile updated')
      setShowSuccess(true)
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Failed to update profile.'
      setMsg(detail)
    } finally {
      setSaving(false)
      setShowNameModal(false)
    }
  }

  const openPassModal = () => { if (!canEdit) return; setPwdDraft({ current: '', next: '', confirm: '' }); setShowPassModal(true) }
  const savePassword = async () => {
    const currentPwd = pwdDraft.current.trim()
    const nextPwd = pwdDraft.next.trim()
    const confirmPwd = pwdDraft.confirm.trim()

    if (!currentPwd || !nextPwd || !confirmPwd) {
      setPwdError('Please fill in all password fields.')
      return
    }
    if (nextPwd !== confirmPwd) {
      setPwdError('New password and confirm password must match.')
      return
    }
    if (!isStrongPassword(nextPwd)) {
      const msg = 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character'
      setPwdError(msg)
      toast.showError(msg)
      return
    }

    setPwdError('')
    setMsg('')
    try {
      setSaving(true)
      await updateMe({ current_password: currentPwd, password: nextPwd })
      const successMsg = 'Your password has been successfully updated.'
      setMsg(successMsg)
      setShowSuccess(true)
      toast.showSuccess(successMsg)
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Failed to update password.'
      setMsg(detail)
      setPwdError(detail)
      toast.showError(detail)
    } finally {
      setSaving(false)
      setShowPassModal(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar selectedDept={'all'} onChangeDept={() => {}} onLogout={logout} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-semibold">
              {user?.name ? user.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() : 'U'}
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900">{user?.name || 'User'}</div>
              <div className="text-sm text-gray-500">{user?.department || '—'} · {user?.email || ''}</div>
            </div>
            {canEdit && (
              <button onClick={logout} className="ml-auto px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">Logout</button>
            )}
          </div>

          {canEdit && (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {msg && <div className="md:col-span-2 text-sm {msg.includes('Failed') ? 'text-red-600' : 'text-emerald-700'}">{msg}</div>}
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600" value={user?.email || ''} readOnly />
              </div>
              {!editMode && (
                <div className="md:col-span-2 flex items-center justify-end">
                  <button onClick={() => setEditMode(true)} className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Edit Profile</button>
                </div>
              )}
              {editMode && (
                <>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-1">Username</label>
                      <input className="w-full px-3 py-2 border rounded-md bg-white" value={form.name} readOnly />
                    </div>
                    <button onClick={openNameModal} disabled={saving} className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">Edit Name</button>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-1">Password</label>
                      <input type="password" className="w-full px-3 py-2 border rounded-md bg-gray-50" value="********" readOnly />
                    </div>
                    <button onClick={openPassModal} disabled={saving} className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">Edit Password</button>
                  </div>
                  <div className="md:col-span-2 flex items-center justify-end">
                    <button onClick={() => setEditMode(false)} className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Done</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-2">Shout-outs created by {user?.name?.split(' ')[0] || 'user'}</div>
            {user && <Feed department={'all'} senderId={user.id} />}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-2">Shout-outs where {user?.name?.split(' ')[0] || 'user'} was tagged</div>
            {user && <Feed department={'all'} taggedUserId={user.id} />}
          </div>
        </div>
      </main>

      {/* Name Edit Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold">Edit Name</h3>
              <button onClick={() => setShowNameModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">New name</label>
                <input className="w-full px-3 py-2 border rounded-md" value={nameDraft} onChange={(e)=>setNameDraft(e.target.value)} />
              </div>
              <div className="text-sm text-gray-600">Are you sure you want to save changes?</div>
              <div className="pt-1 flex items-center justify-end gap-2">
                <button onClick={() => setShowNameModal(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Cancel</button>
                <button onClick={saveName} disabled={saving || !nameDraft.trim()} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Edit Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold">Change Password</h3>
              <button onClick={() => setShowPassModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showPwd.current ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border rounded-md"
                    value={pwdDraft.current}
                    onChange={(e)=>setPwdDraft(p=>({...p, current: e.target.value}))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => ({ ...p, current: !p.current }))}
                    className="absolute inset-y-0 right-0 px-3 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPwd.current ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showPwd.next ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border rounded-md"
                    value={pwdDraft.next}
                    onChange={(e)=>setPwdDraft(p=>({...p, next: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => ({ ...p, next: !p.next }))}
                    className="absolute inset-y-0 right-0 px-3 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPwd.next ? 'Hide' : 'Show'}
                  </button>
                </div>
                {pwdDraft.next && (
                  <div className="mt-1 text-xs">
                    {passwordStrengthLevel(pwdDraft.next) === 'weak' && (
                      <span className="text-red-600">Password strength: Weak</span>
                    )}
                    {passwordStrengthLevel(pwdDraft.next) === 'medium' && (
                      <span className="text-yellow-600">Password strength: Medium</span>
                    )}
                    {passwordStrengthLevel(pwdDraft.next) === 'strong' && (
                      <span className="text-emerald-600">Password strength: Strong</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showPwd.confirm ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border rounded-md"
                    value={pwdDraft.confirm}
                    onChange={(e)=>setPwdDraft(p=>({...p, confirm: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => ({ ...p, confirm: !p.confirm }))}
                    className="absolute inset-y-0 right-0 px-3 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPwd.confirm ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              {pwdError && (
                <div className="text-sm text-red-600">{pwdError}</div>
              )}
              {pwdDraft.next && pwdDraft.confirm && pwdDraft.next !== pwdDraft.confirm && (
                <div className="text-sm text-red-600">New password and confirm password do not match.</div>
              )}
              <div className="text-sm text-gray-600">Are you sure you want to save changes?</div>
              <div className="pt-1 flex items-center justify-end gap-2">
                <button onClick={() => setShowPassModal(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Cancel</button>
                <button
                  onClick={savePassword}
                  disabled={
                    saving ||
                    !pwdDraft.current.trim() ||
                    !pwdDraft.next.trim() ||
                    !pwdDraft.confirm.trim()
                  }
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="px-5 py-4">
              <div className="text-sm text-gray-900 font-medium">{msg || 'Changes saved successfully'}</div>
              <div className="mt-4 flex items-center justify-end">
                <button onClick={() => setShowSuccess(false)} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
