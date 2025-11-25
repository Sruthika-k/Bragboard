import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, ...toast }])
    const duration = toast.duration ?? 3000
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const value = {
    showSuccess: (message) => showToast({ type: 'success', message }),
    showError: (message) => showToast({ type: 'error', message }),
    showInfo: (message) => showToast({ type: 'info', message }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 top-4 flex flex-col items-center z-50 space-y-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md w-full rounded-lg shadow-lg px-4 py-3 text-sm font-medium border ${
              t.type === 'error'
                ? 'bg-red-100 border-red-200 text-red-800'
                : t.type === 'success'
                ? 'bg-green-100 border-green-200 text-green-800'
                : 'bg-gray-900 text-gray-50 border-gray-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
