import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Icons are served from our own origin. From the cdnjs CDN they rendered as
// empty boxes whenever that font was blocked or slow for a visitor.
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import { initErrorTracker } from './utils/errorTracker'

initErrorTracker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
