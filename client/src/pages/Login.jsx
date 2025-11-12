import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from '../config'

// --- CONFIGURATION ---

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // New state for loading/disabling button
  const [feedback, setFeedback] = useState({ message: '', isError: false }) // New state for feedback

  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFeedback({ message: '', isError: false }) // Clear previous feedback

    let hasError = false
    if (!email) {
      setEmailError('Please enter your email.')
      hasError = true
    } else if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.')
      hasError = true
    } else {
      setEmailError('')
    }

    if (!password) {
      setPasswordError('Please enter your password.')
      hasError = true
    } else {
      setPasswordError('')
    }

    if (hasError) return

    setIsLoading(true)

    // --- API CALL (axios + timeout, JSON body) ---
    try {
      const res = await axios.post(`${API_BASE_URL}/login`, { email, password }, { timeout: 8000 })

      if (res.status === 200 && res.data?.access_token) {
        localStorage.setItem('access_token', res.data.access_token)
        localStorage.setItem('token_type', res.data.token_type || 'bearer')
        setFeedback({ message: 'Login successful! Redirecting...', isError: false })
        setTimeout(() => navigate('/dashboard'), 300)
      } else {
        setFeedback({ message: 'Unexpected response from server.', isError: true })
        setPassword('')
      }
    } catch (error) {
      console.error('Login error:', error)
      const msg = error?.response?.data?.detail || 'Login failed. Please check credentials or server connection.'
      setFeedback({ message: msg, isError: true })
      setPassword('')
    } finally {
      setIsLoading(false)
    }
    // --- END API CALL ---
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f5ff] to-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-xl shadow-lg border border-gray-100 p-8 sm:p-10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
        {/* Branding & Headings */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">
              BragBoard
            </h1>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-indigo-600 mb-2">
            Welcome back to BragBoard
          </h2>
          <p className="text-sm sm:text-base text-gray-500">
            Sign in to appreciate your teammates
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError('')
              }}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-gray-300"
              aria-invalid={emailError ? 'true' : 'false'}
              aria-describedby={emailError ? 'email-error' : undefined}
              disabled={isLoading}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-red-500 mt-1">
                {emailError}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError('')
                }}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-gray-300"
                aria-invalid={passwordError ? 'true' : 'false'}
                aria-describedby={passwordError ? 'password-error' : undefined}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-4 flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError && (
              <p id="password-error" className="text-sm text-red-500 mt-1">
                {passwordError}
              </p>
            )}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading} // Disable button while loading
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold text-base shadow-md transition-all duration-200 hover:from-indigo-600 hover:to-blue-600 hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
          > 
            {isLoading ? 'Signing In...' : 'Sign In'} 
          </button>
          
        </form>

        {/* Feedback Message */}
        {feedback.message && (
          <div 
            className={`mt-6 p-4 rounded-xl text-sm font-semibold ${feedback.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
          >
            <p>{feedback.message}</p>
          </div>
        )}

        {/* Bottom Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link 
              to="/signup" 
              className="font-medium text-indigo-500 hover:text-indigo-600 transition-colors duration-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}