import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { flightsApi } from '../api/flights'
import { airportsApi } from '../api/airports'

function Home() {
  const { user, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Initialize state from URL parameters
  const [origin, setOrigin] = useState(searchParams.get('origin') || '')
  const [destination, setDestination] = useState(searchParams.get('destination') || '')
  const [date, setDate] = useState(searchParams.get('date') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [airports, setAirports] = useState([])
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    airportsApi.list({ page_size: 100 }).then((res) => {
      setAirports(res.data.data || [])
    })
  }, [])

  const performSearch = async (searchOrigin, searchDestination, searchDate, showAlert = true) => {
    setLoading(true)
    setHasSearched(true)
    try {
      const params = { origin: searchOrigin, destination: searchDestination }
      if (searchDate) {
        params.date = searchDate
      }
      const res = await flightsApi.list(params)
      setResults(res.data.data || [])
      
      // Update URL with search parameters
      const newSearchParams = new URLSearchParams()
      newSearchParams.set('origin', searchOrigin)
      newSearchParams.set('destination', searchDestination)
      if (searchDate) {
        newSearchParams.set('date', searchDate)
      }
      setSearchParams(newSearchParams, { replace: true })
      
      if (res.data.data.length === 0 && showAlert) {
        alert('No flights found for this route')
      }
    } catch (error) {
      console.error('Search error:', error)
      if (showAlert) {
        alert(error.error?.message || 'Error searching flights')
      }
    } finally {
      setLoading(false)
    }
  }

  // Restore search results from URL parameters on mount
  useEffect(() => {
    const urlOrigin = searchParams.get('origin')
    const urlDestination = searchParams.get('destination')
    const urlDate = searchParams.get('date')
    
    if (urlOrigin && urlDestination) {
      // Restore search state from URL
      setOrigin(urlOrigin)
      setDestination(urlDestination)
      if (urlDate) setDate(urlDate)
      
      // Automatically perform search if we have origin and destination
      performSearch(urlOrigin, urlDestination, urlDate, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  const handleSearch = async (e) => {
    e.preventDefault()
    
    if (!origin || !destination) {
      alert('Please select both origin and destination airports')
      return
    }
    
    if (origin === destination) {
      alert('Origin and destination must be different')
      return
    }
    
    await performSearch(origin, destination, date, true)
  }

  const handleClear = () => {
    setOrigin('')
    setDestination('')
    setDate('')
    setResults([])
    setHasSearched(false)
    // Clear URL parameters
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="container">
      <div className="card" style={{ 
        background: 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', color: '#007bff' }}>
            Search Flights
          </h2>
          <p style={{ color: '#666', fontSize: '15px' }}>
            Find the perfect flight with intelligent price and delay predictions
          </p>
        </div>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div className="form-group">
              <label>Origin Airport *</label>
              <select 
                value={origin} 
                onChange={(e) => setOrigin(e.target.value)}
                required
              >
                <option value="">Select Origin</option>
                {airports.map((ap) => (
                  <option key={ap.airport_code} value={ap.airport_code}>
                    {ap.airport_code} - {ap.airport_name}, {ap.city}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Destination Airport *</label>
              <select 
                value={destination} 
                onChange={(e) => setDestination(e.target.value)}
                required
              >
                <option value="">Select Destination</option>
                {airports.map((ap) => (
                  <option key={ap.airport_code} value={ap.airport_code}>
                    {ap.airport_code} - {ap.airport_name}, {ap.city}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <div className="form-group" style={{ maxWidth: '300px' }}>
              <label>Date (Optional)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: '100%' }}
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                Filter flights by specific date (optional)
              </small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Searching...' : 'Search Flights'}
            </button>
            {hasSearched && (
              <button type="button" className="btn btn-secondary" onClick={handleClear}>
                Clear Search
              </button>
            )}
          </div>
        </form>
      </div>

      {hasSearched && (
        <div className="card" style={{ 
          marginTop: '20px',
          background: 'rgba(255, 255, 255, 0.95)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '22px', color: '#333' }}>
              Search Results: <span style={{ color: '#007bff' }}>{origin}</span> → <span style={{ color: '#28a745' }}>{destination}</span>
            </h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              {date && (
                <span style={{ 
                  fontSize: '13px', 
                  color: '#666', 
                  background: 'rgba(0, 123, 255, 0.1)', 
                  padding: '4px 10px', 
                  borderRadius: '12px' 
                }}>
                  {date}
                </span>
              )}
              {results.length > 0 && (
                <span style={{ 
                  fontSize: '13px', 
                  color: '#28a745', 
                  fontWeight: 'bold',
                  background: 'rgba(40, 167, 69, 0.1)', 
                  padding: '4px 10px', 
                  borderRadius: '12px' 
                }}>
                  {results.length} flight{results.length !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
          </div>
          
          {results.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#666' }}>
              <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No flights found for this route</p>
              <p style={{ fontSize: '14px', color: '#999' }}>
                Try selecting different airports or check back later for new routes.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Flight No</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Operations</th>
                    <th>Cancelled</th>
                    <th>Cancellation Rate</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((flight) => {
                    // Calculate cancellation rate from actual counts for accuracy
                    // Always calculate from num_cancelled (count) and total_ops to get exact percentage
                    let cancelRate = 0
                    if (flight.total_ops > 0 && flight.num_cancelled !== undefined && flight.num_cancelled !== null) {
                      // Calculate exact percentage from counts
                      cancelRate = (Number(flight.num_cancelled) / Number(flight.total_ops)) * 100
                    } else if (flight.percent_cancelled !== undefined && flight.percent_cancelled !== null) {
                      // Fallback: use stored percent_cancelled if counts not available
                      cancelRate = Number(flight.percent_cancelled)
                    }
                    
                    // Color based on cancellation rate (lower is better)
                    // Green: <20%, Yellow: 20-40%, Red: >40%
                    const cancelRateColor = cancelRate < 20 ? '#28a745' : cancelRate < 40 ? '#ffc107' : '#dc3545'
                    
                    return (
                      <tr key={flight.flight_id} style={{ transition: 'background-color 0.2s' }}>
                        <td><strong style={{ color: '#007bff' }}>{flight.flight_no}</strong></td>
                        <td>
                          <div>
                            <strong>{flight.origin_airport}</strong>
                            {flight.origin && <div style={{ fontSize: '12px', color: '#666' }}>{flight.origin.city}</div>}
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong>{flight.destination_airport}</strong>
                            {flight.destination && <div style={{ fontSize: '12px', color: '#666' }}>{flight.destination.city}</div>}
                          </div>
                        </td>
                        <td>{flight.total_ops}</td>
                        <td>{flight.num_cancelled}</td>
                        <td>
                          <span style={{ 
                            color: cancelRateColor, 
                            fontWeight: 'bold',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: `${cancelRateColor}20`
                          }}>
                            {cancelRate.toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              // Navigate to flight insights page with search params preserved
                              const params = new URLSearchParams()
                              params.set('origin', origin)
                              params.set('destination', destination)
                              if (date) params.set('date', date)
                              navigate(`/flight-insights/${encodeURIComponent(flight.flight_id)}?${params.toString()}`)
                            }}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="card" style={{ 
          marginTop: '20px', 
          background: 'rgba(248, 249, 250, 0.95)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {isAdmin() && (
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate('/flights')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Browse All Flights
              </button>
            )}
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/airports')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              View Airports
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/airlines')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              View Airlines
            </button>
            {isAdmin() && (
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate('/daily-weather')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Manage Weather Data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Home

