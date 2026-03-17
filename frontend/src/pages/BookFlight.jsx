import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { flightsApi } from '../api/flights'
import { flightInsightsApi } from '../api/flightInsights'

function BookFlight() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  
  // Get search parameters from URL to preserve when going back
  const searchParams = new URLSearchParams(location.search)
  const [flight, setFlight] = useState(null)
  const [priceGuidance, setPriceGuidance] = useState(null)
  const [delayRisk, setDelayRisk] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchFlightDetails()
    }
  }, [id])

  const fetchFlightDetails = async () => {
    setLoading(true)
    try {
      const res = await flightsApi.get(id)
      setFlight(res.data.data)
      
      // Fetch insights
      if (res.data.data.origin_airport && res.data.data.destination_airport) {
        const today = new Date().toISOString().split('T')[0]
        try {
          const priceRes = await flightInsightsApi.priceGuidance(
            res.data.data.origin_airport,
            res.data.data.destination_airport,
            today
          )
          setPriceGuidance(priceRes.data)
        } catch (e) {
          console.error('Error fetching price guidance:', e)
        }
        
        try {
          const delayRes = await flightInsightsApi.delayRisk(res.data.data.origin_airport, today)
          setDelayRisk(delayRes.data)
        } catch (e) {
          console.error('Error fetching delay risk:', e)
        }
      }
    } catch (error) {
      console.error('Error fetching flight details:', error)
      alert(error.error?.message || 'Error fetching flight details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  if (!flight) {
    return <div className="container">Flight not found</div>
  }

  return (
    <div className="container">
      <button 
        className="btn btn-secondary" 
        onClick={() => {
          if (isAdmin()) {
            navigate('/flights')
          } else {
            // Preserve search parameters when going back to home
            const backUrl = searchParams.toString() ? `/?${searchParams.toString()}` : '/'
            navigate(backUrl)
          }
        }}
        style={{ 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        ← {isAdmin() ? 'Back to Flights' : 'Back to Search'}
      </button>
      
      <div className="card" style={{ 
        background: 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#333' }}>Flight Information: <span style={{ color: '#007bff' }}>{flight.flight_no}</span></h2>
        </div>
        <div style={{ 
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px'
        }}>
          <div style={{ padding: '12px', background: 'rgba(0, 123, 255, 0.05)', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Airline</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {flight.airline?.airline_name || 'N/A'}
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(40, 167, 69, 0.05)', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Origin</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {flight.origin?.airport_code} - {flight.origin?.city}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{flight.origin?.airport_name}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(255, 193, 7, 0.05)', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Destination</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {flight.destination?.airport_code} - {flight.destination?.city}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{flight.destination?.airport_name}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(108, 117, 125, 0.05)', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Operations</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {flight.total_ops} total
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#dc3545' }}>
              {flight.num_cancelled} cancelled
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(220, 53, 69, 0.05)', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Reliability</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: flight.total_ops > 0 && (flight.num_cancelled / flight.total_ops) < 0.05 ? '#28a745' : '#dc3545' }}>
              {flight.total_ops > 0 ? `${(100 - (flight.num_cancelled / flight.total_ops) * 100).toFixed(1)}%` : 'N/A'}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              Cancellation: {((flight.num_cancelled / flight.total_ops) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {priceGuidance && (
        <div className="card" style={{ 
          marginTop: '20px', 
          background: priceGuidance.should_wait 
            ? 'rgba(255, 243, 205, 0.95)' 
            : 'rgba(212, 237, 218, 0.95)',
          backdropFilter: 'blur(10px)',
          border: `2px solid ${priceGuidance.should_wait ? '#ffc107' : '#28a745'}`,
          borderRadius: '12px'
        }}>
          <h3 style={{ marginBottom: '15px' }}>
            Price Guidance
          </h3>
          <div style={{ fontSize: '18px', marginTop: '10px' }}>
            <p><strong>Recommendation:</strong> 
              <span style={{ color: priceGuidance.should_wait ? '#856404' : '#155724', fontWeight: 'bold' }}>
                {priceGuidance.should_wait ? ' WAIT' : ' BOOK NOW'}
              </span>
            </p>
            <p><strong>Confidence:</strong> {(priceGuidance.confidence * 100).toFixed(0)}%</p>
            {priceGuidance.current_fare && (
              <p><strong>Current Average Fare:</strong> ${priceGuidance.current_fare.toFixed(2)}</p>
            )}
            {priceGuidance.average_fare && (
              <p><strong>Historical Average:</strong> ${priceGuidance.average_fare.toFixed(2)}</p>
            )}
          </div>
          <p style={{ marginTop: '15px', fontStyle: 'italic', color: '#666' }}>
            {priceGuidance.should_wait 
              ? 'Prices are currently higher than average. Consider waiting for better deals.'
              : 'Prices are reasonable compared to historical averages. Good time to book!'}
          </p>
        </div>
      )}

      {delayRisk && (
        <div className="card" style={{ 
          marginTop: '20px',
          background: delayRisk.risk === 'high' 
            ? 'rgba(248, 215, 218, 0.95)' 
            : delayRisk.risk === 'medium' 
            ? 'rgba(255, 243, 205, 0.95)' 
            : delayRisk.risk === 'unknown'
            ? 'rgba(248, 249, 250, 0.95)'
            : 'rgba(212, 237, 218, 0.95)',
          backdropFilter: 'blur(10px)',
          border: `2px solid ${delayRisk.risk === 'high' ? '#dc3545' : delayRisk.risk === 'medium' ? '#ffc107' : delayRisk.risk === 'unknown' ? '#6c757d' : '#28a745'}`,
          borderRadius: '12px'
        }}>
          <h3 style={{ marginBottom: '15px' }}>
            Delay Risk Assessment
          </h3>
          {delayRisk.risk === 'unknown' ? (
            <div style={{ fontSize: '16px', marginTop: '10px' }}>
              <p style={{ color: '#6c757d', fontWeight: 'bold', marginBottom: '10px' }}>
                Risk Level: UNKNOWN
              </p>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                {delayRisk.message || 'No weather data available for this airport and date.'}
              </p>
              <div style={{ 
                background: 'rgba(108, 117, 125, 0.1)', 
                padding: '12px', 
                borderRadius: '8px',
                marginTop: '15px',
                fontSize: '13px',
                color: '#555'
              }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>How Risk is Calculated:</p>
                <p style={{ marginBottom: '5px' }}>The delay risk score (0-10) is based on weather conditions:</p>
                <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <li>Precipitation: +1 to +2 points (based on amount)</li>
                  <li>Snow: +3 points (any amount), +2 additional if depth &gt;50mm</li>
                  <li>Wind: +1 to +2 points (gusts &gt;15 m/s)</li>
                  <li>Fog: +2 points</li>
                  <li>Thunderstorms: +3 points</li>
                  <li>Heavy cloud cover: +1 point</li>
                  <li>Extreme cold (&lt;-5°C): +1 point</li>
                </ul>
                <p style={{ marginTop: '10px', marginBottom: '0' }}>
                  <strong>Risk Levels:</strong> Low (0-2), Medium (3-5), High (6+)
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '18px', marginTop: '10px' }}>
                <p><strong>Risk Level:</strong> 
                  <span style={{ 
                    color: delayRisk.risk === 'high' ? '#721c24' : delayRisk.risk === 'medium' ? '#856404' : '#155724',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginLeft: '8px'
                  }}>
                    {delayRisk.risk}
                  </span>
                </p>
                {delayRisk.risk_score !== undefined && (
                  <p><strong>Risk Score:</strong> {delayRisk.risk_score}/10</p>
                )}
              </div>
              {delayRisk.weather_conditions && (
                <div style={{ marginTop: '15px' }}>
                  <p><strong>Weather Conditions:</strong></p>
                  <ul>
                    {delayRisk.weather_conditions.precipitation_mm && (
                      <li>Precipitation: {delayRisk.weather_conditions.precipitation_mm}mm</li>
                    )}
                    {delayRisk.weather_conditions.snow_mm && delayRisk.weather_conditions.snow_mm > 0 && (
                      <li>Snow: {delayRisk.weather_conditions.snow_mm}mm</li>
                    )}
                    {delayRisk.weather_conditions.wind_gust_ms && (
                      <li>Wind Gust: {delayRisk.weather_conditions.wind_gust_ms} m/s</li>
                    )}
                    {delayRisk.weather_conditions.fog && <li>Fog: Yes</li>}
                    {delayRisk.weather_conditions.thunder && <li>Thunder: Yes</li>}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="card" style={{ 
        marginTop: '20px',
        background: 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <h3 style={{ marginBottom: '15px' }}>
          Flight Summary
        </h3>
        <p style={{ lineHeight: '1.8', color: '#555' }}>
          This flight information helps you make an informed decision about booking.
        </p>
        <div style={{ 
          marginTop: '15px', 
          padding: '12px', 
          background: 'rgba(0, 123, 255, 0.1)', 
          borderRadius: '8px',
          borderLeft: '4px solid #007bff'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            <strong>Note:</strong> This site provides flight information and booking guidance only. 
            To actually book a flight, please contact the airline directly.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BookFlight

