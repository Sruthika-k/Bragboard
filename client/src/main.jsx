// main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

import { ToastProvider } from './components/Toast.jsx'

const container = document.getElementById('app')
const root = createRoot(container)

root.render(
  <React.StrictMode>
    {/* ⬅️ ToastProvider MUST wrap everything */}
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
)
