import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const savedTheme = window.localStorage.getItem('studyhub.theme.v1') === 'light' ? 'light' : 'dark'
document.documentElement.dataset.theme = savedTheme
document.documentElement.style.colorScheme = savedTheme
import './styles/index.css'
import { AuthGate } from './features/auth/AuthGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate><App /></AuthGate>
  </StrictMode>,
)
