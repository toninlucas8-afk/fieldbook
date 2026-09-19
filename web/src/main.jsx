import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './stili.css'

createRoot(document.getElementById('app')).render(
  <React.StrictMode><App /></React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
