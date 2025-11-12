import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from '../config'

// --- CONFIGURATION ---
const DEPARTMENTS = ['Marketing', 'Engineering', 'HR', 'Sales', 'Finance'];

// --- UI COMPONENTS MOVED OUTSIDE FOR STABILITY ---
const InputField = ({ label, name, type, value, onChange, placeholder, error, required = true }) => (
  <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-red-500' : 'border-gray-200'} bg-white shadow-sm text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-gray-300`}
      aria-invalid={error ? 'true' : 'false'}
    />
    {error && (
      <p className="text-sm text-red-500 mt-1">{error}</p>
    )}
  </div>
);

const PasswordField = ({ value, onChange, error, showPassword, setShowPassword, isLoading }) => (
  <div className="space-y-2">
    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
      Password
      <span className="text-red-500">*</span>
    </label>
    <div className="relative">
      <input
        id="password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder="••••••••"
        required
        className={`w-full px-4 py-3 pr-12 rounded-xl border ${error ? 'border-red-500' : 'border-gray-200'} bg-white shadow-sm text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-gray-300`}
        aria-invalid={error ? 'true' : 'false'}
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
    {error && (
      <p className="text-sm text-red-500 mt-1">{error}</p>
    )}
  </div>
);

// --- MAIN SIGNUP COMPONENT ---
export default function Signup() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', isError: false });

  // Registration State
  const [registerState, setRegisterState] = useState({ 
    name: '', email: '', password: '', department: '' 
  });
  const [registerError, setRegisterError] = useState({ 
    name: '', email: '', password: '', department: '' 
  });

  const [showPassword, setShowPassword] = useState(false);

  // --- UTILITY FUNCTIONS ---
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const clearErrors = () => {
    setRegisterError({ name: '', email: '', password: '', department: '' });
    setFeedback({ message: '', isError: false });
  }
  
  // Unified handler for all state changes (including error clearing)
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // 1. Update the state value
    setRegisterState(p => ({ ...p, [name]: value }));
    
    // 2. Clear the error message for this specific field if it exists
    if (registerError[name]) {
        setRegisterError(p => ({ ...p, [name]: '' }));
    }
  };
  
  // --- API HANDLER ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clearErrors();
    let errors = {};
    let hasError = false;

    // Validation
    if (!registerState.name) { errors.name = 'Please enter your name.'; hasError = true; }
    if (!registerState.email || !isValidEmail(registerState.email)) { errors.email = 'Enter a valid email.'; hasError = true; }
    if (!registerState.password) { errors.password = 'Please enter a password.'; hasError = true; }
    if (!registerState.department) { errors.department = 'Please select a department.'; hasError = true; }
    
    setRegisterError(errors);
    if (hasError) return;

    setIsLoading(true);

    try {
      // API CALL TO FASTAPI /register (JSON)
      const res = await axios.post(`${API_BASE_URL}/register`, {
        name: registerState.name,
        email: registerState.email,
        password: registerState.password,
        department: registerState.department,
        role: 'employee',
        joined_at: new Date().toISOString(),
      }, { timeout: 8000 })

      if (res.status === 200) {
        setFeedback({ message: res.data?.message || 'Registration successful!', isError: false });
        setTimeout(() => navigate('/'), 800);
      } else {
        setFeedback({ message: 'Unexpected response from server.', isError: true });
      }
    } catch (error) {
      console.error('Registration Error:', error)
      const msg = error?.response?.data?.detail || `Registration failed. Email might already be registered.`
      setFeedback({ message: msg, isError: true })
    } finally {
      setIsLoading(false)
      setRegisterState(p => ({ ...p, password: '' }))
    }
  };

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
            Create your BragBoard account
          </h2>
          <p className="text-sm sm:text-base text-gray-500">
            Get started by creating your employee profile.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <InputField
            label="Full Name"
            name="name"
            type="text"
            value={registerState.name}
            onChange={handleChange}
            placeholder="Jane Doe"
            error={registerError.name}
          />
          <InputField
            label="Email Address"
            name="email"
            type="email"
            value={registerState.email}
            onChange={handleChange}
            placeholder="you@example.com"
            error={registerError.email}
          />

          <PasswordField
            value={registerState.password}
            onChange={handleChange}
            error={registerError.password}
            showPassword={showPassword} // Passed state down
            setShowPassword={setShowPassword} // Passed state updater down
            isLoading={isLoading} // Passed state down
          />

          {/* Department Dropdown */}
          <div className="space-y-2">
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
              <span className="text-red-500">*</span>
            </label>
            <select
              id="department"
              name="department"
              value={registerState.department}
              onChange={handleChange}
              required
              className={`w-full px-4 py-3 rounded-xl border ${registerError.department ? 'border-red-500' : 'border-gray-200'} bg-white shadow-sm text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-gray-300`}
              aria-invalid={registerError.department ? 'true' : 'false'}
            >
              <option value="" disabled>Select your team's department</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            {registerError.department && (
              <p className="text-sm text-red-500 mt-1">{registerError.department}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold text-base shadow-md transition-all duration-200 hover:from-indigo-600 hover:to-blue-600 hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Registering...' : 'Register Account'}
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
            Already have an account?{' '}
            <Link 
              to="/" 
              className="font-medium text-indigo-500 hover:text-indigo-600 transition-colors duration-200"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
