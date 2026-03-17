import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Home from './pages/Home'
import Airports from './pages/Airports'
import Airlines from './pages/Airlines'
import Flights from './pages/Flights'
import BookFlight from './pages/BookFlight'
import DailyWeather from './pages/DailyWeather'
import TestTransaction from './pages/TestTransaction'
import FlightInsightsPage from './pages/FlightInsightsPage'
import FareDropReport from './pages/FareDropReport'

function Navbar() {
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()
  
  const isActive = (path) => {
    return location.pathname === path ? 'active' : ''
  }
  
  if (!user) return null
  
  return (
    <div className="navbar">
      <div className="container">
        <h1>Claude-9: Flight Tracker</h1>
        <nav>
          <Link to="/" className={isActive('/')}>Search Flights</Link>
          {isAdmin() && (
            <Link to="/flights" className={isActive('/flights')}>All Flights</Link>
          )}
          {isAdmin() ? (
            <>
              <Link to="/airports" className={isActive('/airports')}>Airports</Link>
              <Link to="/airlines" className={isActive('/airlines')}>Airlines</Link>
              <Link to="/daily-weather" className={isActive('/daily-weather')}>Daily Weather</Link>
              <Link to="/test-transaction" className={isActive('/test-transaction')}>Weather and Flight</Link>
            </>
          ) : (
            <>
              <Link to="/airports" className={isActive('/airports')}>Airports</Link>
              <Link to="/airlines" className={isActive('/airlines')}>Airlines</Link>
              <Link to="/fareDrop-report" className={isActive('/fareDrop-report')}>Analytics</Link>
            </>
          )}
          <span style={{ marginLeft: '20px', color: '#fff' }}>
            {user.user_name} ({user.role})
          </span>
          <button 
            onClick={logout} 
            className="btn btn-secondary" 
            style={{ marginLeft: '12px', padding: '6px 12px' }}
          >
            Logout
          </button>
        </nav>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth()
  
  if (loading) {
    return <div className="container">Loading...</div>
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (adminOnly && !isAdmin()) {
    return <div className="container"><h2>Access Denied. Admin privileges required.</h2></div>
  }
  
  return children
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/flights" element={<ProtectedRoute adminOnly><Flights /></ProtectedRoute>} />
          <Route path="/flights/:id" element={<ProtectedRoute><BookFlight /></ProtectedRoute>} />
          <Route path="/flight-insights/:flightId" element={<ProtectedRoute><FlightInsightsPage /></ProtectedRoute>} />
          <Route path="/airports" element={<ProtectedRoute><Airports /></ProtectedRoute>} />
          <Route path="/airlines" element={<ProtectedRoute><Airlines /></ProtectedRoute>} />
          <Route path="/daily-weather" element={<ProtectedRoute adminOnly><DailyWeather /></ProtectedRoute>} />
          <Route path="/test-transaction" element={<ProtectedRoute adminOnly><TestTransaction /></ProtectedRoute>} />
          <Route path="/fareDrop-report" element={<ProtectedRoute><FareDropReport /></ProtectedRoute>}  />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

