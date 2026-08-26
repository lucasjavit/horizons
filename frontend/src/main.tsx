import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { aplicarTemaInicial } from './lib/tema'

// Antes do React montar: sem isto a página pinta no tema do sistema e o React
// corrige depois, piscando branco para quem escolheu escuro.
aplicarTemaInicial()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
