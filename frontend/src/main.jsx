import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
<<<<<<< HEAD
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './index.css'
=======
import { AuthProvider } from './context/AuthContext'
>>>>>>> fbd6ebd3b5afd882150707b9e79ee3cf74ce7c88
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)