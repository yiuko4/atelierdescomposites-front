import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ProductionPage from './pages/ProductionPage.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/production/:jobId',
    element: <ProductionPage />,
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
