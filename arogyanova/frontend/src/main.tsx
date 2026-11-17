import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="aurora no-print" aria-hidden="true"><span /><span /><span /><span /></div>
          <App />
          <Toaster
            containerClassName="no-print"
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: 'toast-themed',
              style: {
                background: '#fff',
                color: '#172B3A',
                border: '1px solid #E5EAF0',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                borderRadius: '10px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#4FA67A', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#DC2626', secondary: '#fff' },
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
