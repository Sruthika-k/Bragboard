import React from 'react'

export function ConfirmDialog({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, submitting }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {message && <div className="text-sm text-gray-700">{message}</div>}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">{cancelText}</button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 text-sm"
            >
              {submitting ? 'Please wait...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
