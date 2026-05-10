import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppSplit12 from './AppSplit12.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppSplit12 />
  </StrictMode>,
)
