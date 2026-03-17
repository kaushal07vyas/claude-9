import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { flightInsightsApi } from '../api/flightInsights'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid
} from 'recharts'

const FEATURE_METADATA = {
  airline_reliability: {
    label: 'Airline Reliability',
    weight: 25,
    desc: 'Cancellation history of the airline (1.0 = highly reliable)'
  },
  weather_origin: {
    label: 'Origin Weather Risk',
    weight: 20,
    desc: 'Weather-driven risk at the departure airport (0.0 = ideal weather)'
  },
  weather_dest: {
    label: 'Destination Weather Risk',
    weight: 20,
    desc: 'Weather-driven risk at the arrival airport (0.0 = ideal weather)'
  },
  historical_risk: {
    label: 'Historical Risk',
    weight: 15,
    desc: 'Monthly/quarterly weather pattern risk derived from historical data'
  },
  route_popularity: {
    label: 'Route Popularity',
    weight: 10,
    desc: 'Higher operations → better data coverage and lower uncertainty'
  },
  seasonal_factor: {
    label: 'Seasonal Factor',
    weight: 10,
    desc: 'Season-specific adjustments (winter risk vs. summer performance)'
  }
}

const formatFeatureLabel = (key = '') =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function FlightInsightsPage() {
  const { flightId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetDateFromUrl = searchParams.get('date') || ''
  
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(targetDateFromUrl)
  const canvasRef = useRef(null)

  const weatherChartData = useMemo(() => {
    if (!insights?.weather_analysis?.origin || !insights.weather_analysis.destination) {
      return null
    }
    const originWeather = insights.weather_analysis.origin.weather_data
    const destinationWeather = insights.weather_analysis.destination.weather_data
    if (!originWeather || !destinationWeather) {
      return null
    }

    const metrics = [
      {
        label: 'Risk Score',
        originValue: insights.weather_analysis.origin?.risk_score,
        destinationValue: insights.weather_analysis.destination?.risk_score,
        max: 100,
        unit: '/100'
      },
      {
        label: 'Precipitation (mm)',
        originValue: originWeather.prcp_mm,
        destinationValue: destinationWeather.prcp_mm,
        max: 50,
        unit: ' mm'
      },
      {
        label: 'Snow (mm)',
        originValue: originWeather.snow_mm,
        destinationValue: destinationWeather.snow_mm,
        max: 40,
        unit: ' mm'
      },
      {
        label: 'Wind Speed (m/s)',
        originValue: originWeather.wsf2_ms,
        destinationValue: destinationWeather.wsf2_ms,
        max: 40,
        unit: ' m/s'
      },
      {
        label: 'Cloud Cover (%)',
        originValue: (originWeather.cloud_day_frac ?? 0) * 100,
        destinationValue: (destinationWeather.cloud_day_frac ?? 0) * 100,
        max: 100,
        unit: '%'
      }
    ]

    return metrics.map((metric) => {
      const denominator = metric.max || Math.max(
        Math.abs(metric.originValue ?? 0),
        Math.abs(metric.destinationValue ?? 0),
        1
      )
      const originNormalized = metric.originValue !== null && metric.originValue !== undefined
        ? Math.min(100, Math.max(0, (metric.originValue / denominator) * 100))
        : 0
      const destinationNormalized = metric.destinationValue !== null && metric.destinationValue !== undefined
        ? Math.min(100, Math.max(0, (metric.destinationValue / denominator) * 100))
        : 0
      return {
        metric: metric.label,
        origin: Number(originNormalized.toFixed(2)),
        destination: Number(destinationNormalized.toFixed(2)),
        originActual: metric.originValue,
        destinationActual: metric.destinationValue,
        unit: metric.unit
      }
    })
  }, [insights])

  const featureChartData = useMemo(() => {
    if (!insights?.ml_predictions?.features) return null
    const entries = Object.entries(insights.ml_predictions.features || {})
    if (!entries.length) return null
    return entries.map(([key, value]) => {
      const info = FEATURE_METADATA[key] || {}
      const formattedLabel = info.label || formatFeatureLabel(key)
      return {
        feature: formattedLabel,
        normalizedValue: Math.min(100, Math.max(0, (value ?? 0) * 100)),
        weight: info.weight ?? 0,
        rawValue: value ?? 0,
        description: info.desc || 'Feature value used in the ML model'
      }
    })
  }, [insights])

  const formatWeatherValue = (value, unit = '') => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/A'
    }
    const numericValue = typeof value === 'number' ? value : Number(value)
    if (Number.isNaN(numericValue)) {
      return 'N/A'
    }
    const decimals = Math.abs(numericValue) >= 10 ? 1 : 2
    return `${numericValue.toFixed(decimals)}${unit}`
  }

  const WeatherTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) {
      return null
    }
    const dataPoint = payload[0].payload
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px', minWidth: '180px' }}>
        <strong style={{ display: 'block', marginBottom: '6px' }}>{label}</strong>
        <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
          <div><strong>Origin:</strong> {formatWeatherValue(dataPoint.originActual, dataPoint.unit)}</div>
          <div><strong>Destination:</strong> {formatWeatherValue(dataPoint.destinationActual, dataPoint.unit)}</div>
        </div>
      </div>
    )
  }

  const FeatureTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) {
      return null
    }
    const dataPoint = payload[0].payload
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px', maxWidth: '220px' }}>
        <strong style={{ display: 'block', marginBottom: '6px' }}>{dataPoint.feature}</strong>
        <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
          <div><strong>Feature value:</strong> {dataPoint.rawValue?.toFixed ? dataPoint.rawValue.toFixed(2) : dataPoint.rawValue}</div>
          <div><strong>Model weight:</strong> {dataPoint.weight}%</div>
          <div style={{ marginTop: '4px', color: '#666' }}>{dataPoint.description}</div>
        </div>
      </div>
    )
  }

  const fetchInsights = async () => {
    if (!flightId) return
    
    setLoading(true)
    setError(null)
    try {
      console.log('Fetching insights for flight:', flightId, 'with date:', selectedDate)
      const res = await flightInsightsApi.get(flightId, selectedDate || null)
      console.log('Insights response:', res.data)
      setInsights(res.data.data)
    } catch (err) {
      console.error('Error fetching insights:', err)
      console.error('Error details:', err.response?.data || err.message)
      setError(err.response?.data?.error?.message || err.error?.message || err.message || 'Error fetching flight insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (flightId) {
      fetchInsights()
    }
  }, [flightId, selectedDate])

  const drawChart = useCallback(() => {
    if (!insights || !insights.fare_trend || insights.fare_trend.length === 0) {
      console.log('No fare trend data to draw')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      console.log('Canvas not available')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('Canvas context not available')
      return
    }

    const data = insights.fare_trend
    const width = canvas.width
    const height = canvas.height
    const padding = { top: 50, right: 40, bottom: 80, left: 60 } // More bottom padding for month labels
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    if (data.length === 0) return

    // Filter valid data points first
    const validData = data.filter(point => point.fare && point.fare > 0)
    if (validData.length === 0) return

    // Find min and max values from valid data
    const fares = validData.map(d => d.fare)
    const minFare = Math.min(...fares)
    const maxFare = Math.max(...fares)
    const fareRange = maxFare - minFare || 1
    
    // Add some padding to fare range for better visualization
    const farePadding = fareRange * 0.1
    const adjustedMinFare = Math.max(0, minFare - farePadding)
    const adjustedMaxFare = maxFare + farePadding
    const adjustedFareRange = adjustedMaxFare - adjustedMinFare

    // Draw grid lines first (behind everything)
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    
    // Horizontal grid lines (fare levels)
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }
    
    // Vertical grid lines (time markers)
    const gridInterval = Math.max(1, Math.ceil(validData.length / 8))
    for (let i = 0; i < validData.length; i += gridInterval) {
      const x = padding.left + (i / (validData.length - 1 || 1)) * chartWidth
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top)
    ctx.lineTo(padding.left, height - padding.bottom)
    ctx.lineTo(width - padding.right, height - padding.bottom)
    ctx.stroke()

    // Draw the line connecting all points (validData already filtered above)
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 3
    ctx.fillStyle = '#007bff'
    ctx.beginPath()

    validData.forEach((point, index) => {
      const x = padding.left + (index / (validData.length - 1 || 1)) * chartWidth
      const y = height - padding.bottom - ((point.fare - adjustedMinFare) / adjustedFareRange) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // Draw data points on top of the line
    validData.forEach((point, index) => {
      const x = padding.left + (index / (validData.length - 1 || 1)) * chartWidth
      const y = height - padding.bottom - ((point.fare - adjustedMinFare) / adjustedFareRange) * chartHeight

      // Draw point circle
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, 2 * Math.PI)
      ctx.fillStyle = '#007bff'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw fare value above point (for key points)
      if (index === 0 || index === validData.length - 1 || index % Math.ceil(validData.length / 6) === 0) {
        ctx.fillStyle = '#007bff'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`$${point.fare.toFixed(0)}`, x, y - 15)
      }
    })

    // Draw labels
    ctx.fillStyle = '#333'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    
    // X-axis labels (months) - show month names (Jan-Dec format)
    ctx.fillStyle = '#333'
    ctx.font = '11px Arial'
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    // Show month labels on X-axis for all valid data points
    validData.forEach((point, index) => {
      const x = padding.left + (index / (validData.length - 1 || 1)) * chartWidth
      
      // Show month name (e.g., "Jan", "Feb", "Mar")
      let label = ''
      if (point.month) {
        label = monthNames[point.month - 1]
        // Add year if it's January or if it's the first data point
        if (point.month === 1 || index === 0) {
          label += ` ${point.year}`
        }
      } else {
        label = point.period || point.date || `${point.year}-${point.quarter}`
      }
      
      // Rotate labels slightly if there are many points to avoid overlap
      const shouldRotate = validData.length > 12
      if (shouldRotate) {
        ctx.save()
        ctx.translate(x, height - padding.bottom + 15)
        ctx.rotate(-Math.PI / 4)
        ctx.fillStyle = '#333'
        ctx.font = '10px Arial'
        ctx.textAlign = 'left'
        ctx.fillText(label, 0, 0)
        ctx.restore()
      } else {
        ctx.fillStyle = '#333'
        ctx.font = '11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(label, x, height - padding.bottom + 20)
      }
      
      // Draw a small tick mark for every point
      ctx.beginPath()
      ctx.moveTo(x, height - padding.bottom)
      ctx.lineTo(x, height - padding.bottom + 5)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // Y-axis labels (fares)
    ctx.fillStyle = '#333'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const fare = adjustedMinFare + (i / 5) * adjustedFareRange
      const y = height - padding.bottom - (i / 5) * chartHeight
      ctx.fillText(`$${fare.toFixed(0)}`, padding.left - 10, y + 4)
    }

    // Title and axis labels
    ctx.textAlign = 'center'
    ctx.font = 'bold 16px Arial'
    ctx.fillText('Fare History Trend (Fare vs Months)', width / 2, 30)
    
    // Y-axis label
    ctx.save()
    ctx.translate(15, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.font = '12px Arial'
    ctx.fillText('Fare ($)', 0, 0)
    ctx.restore()
    
    // X-axis label
    ctx.font = '12px Arial'
    ctx.fillText('Months (Jan - Dec)', width / 2, height - 15)
  }, [insights])

  useEffect(() => {
    if (insights && insights.fare_trend && insights.fare_trend.length > 0) {
      const timer = setTimeout(() => {
        drawChart()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [insights, drawChart])

  const getReliabilityColor = (score) => {
    if (score >= 80) return '#4CAF50' // Green
    if (score >= 60) return '#FF9800' // Orange
    return '#F44336' // Red
  }

  const getRecommendationColor = (recommendation) => {
    if (recommendation.includes('RECOMMENDED')) return '#4CAF50'
    if (recommendation.includes('CAUTION')) return '#FF9800'
    return '#F44336'
  }

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value)
  }

  // Get back URL from search params
  const getBackUrl = () => {
    const origin = searchParams.get('origin')
    const destination = searchParams.get('destination')
    const date = searchParams.get('date')
    
    if (origin && destination) {
      const params = new URLSearchParams({ origin, destination })
      if (date) params.set('date', date)
      return `/?${params.toString()}`
    }
    return '/'
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Loading Flight Insights...</h2>
        <p>Please wait while we analyze the flight data.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '40px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate(getBackUrl())}
          style={{ marginBottom: '20px' }}
        >
          ← Back to Search
        </button>
        <div className="card" style={{ padding: '20px', backgroundColor: '#f8d7da', color: '#721c24' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="container" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>No Flight Insights Available</h2>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate(getBackUrl())}
          style={{ marginTop: '20px' }}
        >
          ← Back to Search
        </button>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '1400px' }}>
      <button 
        className="btn btn-secondary" 
        onClick={() => navigate(getBackUrl())}
        style={{ marginBottom: '20px' }}
      >
        ← Back to Search
      </button>

      <div className="card" style={{ marginBottom: '20px', padding: '20px' }} id="insights-content">
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Flight Insights & Analysis</h2>
        
        {/* Flight Information */}
        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Flight Information</h3>
          <p><strong>Flight:</strong> {insights.flight.flight_no}</p>
          <p><strong>Airline:</strong> {insights.flight.airline?.airline_name || insights.flight.airline_id}</p>
          <p><strong>Route:</strong> {insights.flight.origin?.airport_code} → {insights.flight.destination?.airport_code}</p>
          
          {/* Date Input */}
          <div id="date-input-section" style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #ddd' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Select Travel Date (Optional):
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                width: '200px'
              }}
            />
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
              {selectedDate 
                ? `Analyzing predictions for ${selectedDate}` 
                : 'Leave empty to see optimal travel period suggestions'}
            </p>
            {loading && selectedDate && (
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#2196F3', fontStyle: 'italic' }}>
                Loading insights for {selectedDate}...
              </p>
            )}
          </div>
          
          {insights.target_date && (
            <p style={{ marginTop: '10px' }}><strong>Target Date:</strong> {insights.target_date}</p>
          )}
        </div>

        {/* Travel Suggestions (when no date provided) */}
        {!insights.has_target_date && (
          <div style={{ 
            marginBottom: '30px', 
            padding: '20px', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px',
            border: '2px solid #2196F3'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#1976D2' }}>
              Optimal Travel Period Suggestions
            </h3>
            {insights.travel_suggestions ? (
              <>
                <p style={{ marginBottom: '20px', color: '#555' }}>
                  {insights.travel_suggestions.message || 'Based on historical fare trends and weather patterns, here are the best times to travel:'}
                </p>
                
                {insights.travel_suggestions.suggestions && insights.travel_suggestions.suggestions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {insights.travel_suggestions.suggestions.map((suggestion, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: '15px',
                          backgroundColor: '#fff',
                          borderRadius: '6px',
                          border: '1px solid #90caf9',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, color: '#1976D2' }}>{suggestion.quarter}</h4>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: suggestion.strength === 'HIGHLY RECOMMENDED' ? '#4CAF50' :
                                           suggestion.strength === 'RECOMMENDED' ? '#FF9800' : '#9E9E9E',
                            color: '#fff'
                          }}>
                            {suggestion.strength}
                          </span>
                        </div>
                        <p style={{ margin: '5px 0', fontWeight: 'bold' }}>{suggestion.period}</p>
                        <p style={{ margin: '5px 0', color: '#666' }}>{suggestion.reason}</p>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '14px' }}>
                          {suggestion.average_fare !== null && suggestion.average_fare !== undefined ? (
                            <span><strong>Avg Fare:</strong> ${suggestion.average_fare}</span>
                          ) : (
                            <span><strong>Avg Fare:</strong> Not available</span>
                          )}
                          <span><strong>Weather Score:</strong> {suggestion.weather_score}/100 (lower is better)</span>
                        </div>
                        <button
                          onClick={() => {
                            // Open in new tab with the selected date
                            const params = new URLSearchParams()
                            params.set('date', suggestion.start_date)
                            const origin = searchParams.get('origin')
                            const destination = searchParams.get('destination')
                            if (origin) params.set('origin', origin)
                            if (destination) params.set('destination', destination)
                            
                            const url = `/flight-insights/${encodeURIComponent(flightId)}?${params.toString()}`
                            window.open(url, '_blank')
                          }}
                          style={{
                            marginTop: '10px',
                            padding: '6px 12px',
                            backgroundColor: '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
                        >
                          Analyze This Period (New Tab)
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#666' }}>Insufficient historical data to generate travel suggestions.</p>
                )}
              </>
            ) : (
              <p style={{ color: '#666' }}>Loading travel suggestions...</p>
            )}
          </div>
        )}

        {/* Summary Table - All Key Metrics */}
        {insights.has_target_date && (
          <div style={{ 
            marginBottom: '30px', 
            padding: '20px', 
            backgroundColor: '#fff', 
            borderRadius: '8px',
            border: '2px solid #28a745',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#28a745' }}>
              Complete Insights Summary
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0b5ed7', color: '#fff', fontWeight: 'bold' }}>
                    {['Category', 'Metric', 'Value', 'Status'].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: '12px',
                          border: '1px solid #0948a6',
                          backgroundColor: '#0b5ed7',
                          color: '#fff'
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td rowSpan="3" style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>ML Predictions</td>
                    <td>Reliability Score</td>
                    <td style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      {insights.ml_predictions?.reliability_score?.toFixed(1) || insights.reliability?.score?.toFixed(1) || 'N/A'}%
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: getReliabilityColor(insights.ml_predictions?.reliability_score || insights.reliability?.score || 0) + '40',
                        color: getReliabilityColor(insights.ml_predictions?.reliability_score || insights.reliability?.score || 0),
                        fontWeight: 'bold'
                      }}>
                        {insights.ml_predictions?.reliability_score >= 80 ? 'Excellent' :
                         insights.ml_predictions?.reliability_score >= 60 ? 'Good' : 'Fair'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Delay Probability</td>
                    <td style={{ fontWeight: 'bold', color: '#dc3545' }}>
                      {insights.ml_predictions?.delay_probability?.toFixed(2) || 'N/A'}%
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: (insights.ml_predictions?.delay_probability || 0) < 20 ? '#d4edda' : 
                                       (insights.ml_predictions?.delay_probability || 0) < 40 ? '#fff3cd' : '#f8d7da',
                        color: (insights.ml_predictions?.delay_probability || 0) < 20 ? '#155724' : 
                              (insights.ml_predictions?.delay_probability || 0) < 40 ? '#856404' : '#721c24',
                        fontWeight: 'bold'
                      }}>
                        {(insights.ml_predictions?.delay_probability || 0) < 20 ? 'Low' :
                         (insights.ml_predictions?.delay_probability || 0) < 40 ? 'Medium' : 'High'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Cancellation Probability</td>
                    <td style={{ fontWeight: 'bold', color: '#dc3545' }}>
                      {insights.ml_predictions?.cancellation_probability?.toFixed(2) || insights.reliability?.cancellation_probability?.toFixed(2) || 'N/A'}%
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: (insights.ml_predictions?.cancellation_probability || insights.reliability?.cancellation_probability || 0) < 10 ? '#d4edda' : 
                                       (insights.ml_predictions?.cancellation_probability || insights.reliability?.cancellation_probability || 0) < 20 ? '#fff3cd' : '#f8d7da',
                        color: (insights.ml_predictions?.cancellation_probability || insights.reliability?.cancellation_probability || 0) < 10 ? '#155724' : 
                              (insights.ml_predictions?.cancellation_probability || insights.reliability?.cancellation_probability || 0) < 20 ? '#856404' : '#721c24',
                        fontWeight: 'bold'
                      }}>
                        {(insights.ml_predictions?.cancellation_probability || insights.reliability?.cancellation_probability || 0) < 10 ? 'Low' :
                         (insights.ml_predictions?.cancellation_probability || insights.reliability?.cancellation_probability || 0) < 20 ? 'Medium' : 'High'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td rowSpan="2" style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>Weather</td>
                    <td>Origin Risk</td>
                    <td style={{ fontWeight: 'bold' }}>
                      {insights.weather_analysis?.origin?.risk_score?.toFixed(1) || 'N/A'}/100
                    </td>
                    <td>
                      {insights.weather_analysis?.origin?.risk_score && (
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          backgroundColor: insights.weather_analysis.origin.risk_score < 30 ? '#d4edda' : 
                                         insights.weather_analysis.origin.risk_score < 60 ? '#fff3cd' : '#f8d7da',
                          color: insights.weather_analysis.origin.risk_score < 30 ? '#155724' : 
                                insights.weather_analysis.origin.risk_score < 60 ? '#856404' : '#721c24',
                          fontWeight: 'bold'
                        }}>
                          {insights.weather_analysis.origin.risk_score < 30 ? 'Low' :
                           insights.weather_analysis.origin.risk_score < 60 ? 'Medium' : 'High'}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Destination Risk</td>
                    <td style={{ fontWeight: 'bold' }}>
                      {insights.weather_analysis?.destination?.risk_score?.toFixed(1) || 'N/A'}/100
                    </td>
                    <td>
                      {insights.weather_analysis?.destination?.risk_score && (
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          backgroundColor: insights.weather_analysis.destination.risk_score < 30 ? '#d4edda' : 
                                         insights.weather_analysis.destination.risk_score < 60 ? '#fff3cd' : '#f8d7da',
                          color: insights.weather_analysis.destination.risk_score < 30 ? '#155724' : 
                                insights.weather_analysis.destination.risk_score < 60 ? '#856404' : '#721c24',
                          fontWeight: 'bold'
                        }}>
                          {insights.weather_analysis.destination.risk_score < 30 ? 'Low' :
                           insights.weather_analysis.destination.risk_score < 60 ? 'Medium' : 'High'}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>Fare</td>
                    <td>Predicted Fare</td>
                    <td style={{ fontWeight: 'bold', fontSize: '16px', color: '#007bff' }}>
                      ${insights.fare_prediction?.predicted_fare?.toFixed(2) || 'N/A'}
                    </td>
                    <td>
                      {insights.fare_prediction?.predicted_fare && insights.fare_prediction?.current_fare && (
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          backgroundColor: insights.fare_prediction.predicted_fare < insights.fare_prediction.current_fare ? '#d4edda' : '#fff3cd',
                          color: insights.fare_prediction.predicted_fare < insights.fare_prediction.current_fare ? '#155724' : '#856404',
                          fontWeight: 'bold'
                        }}>
                          {insights.fare_prediction.predicted_fare < insights.fare_prediction.current_fare ? 'Good Deal' : 'Higher Than Current'}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>Recommendation</td>
                    <td>Booking Decision</td>
                    <td style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      {insights.recommendation?.recommendation || 'N/A'}
                    </td>
                    <td>
                      {insights.recommendation?.recommendation && (
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          backgroundColor: getRecommendationColor(insights.recommendation.recommendation) + '40',
                          color: getRecommendationColor(insights.recommendation.recommendation),
                          fontWeight: 'bold'
                        }}>
                          {insights.recommendation.should_book ? 'Book Now' : 'Consider Alternatives'}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fare Trend Visualization */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>Fare History Trend</h3>
          {insights.fare_trend && insights.fare_trend.length > 0 ? (
            <>
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff', overflowX: 'auto' }}>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={400}
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                />
              </div>
              {insights.fare_prediction?.predicted_fare && (
                <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                  <strong>Predicted Fare:</strong> ${insights.fare_prediction.predicted_fare.toFixed(2)} 
                  (Confidence: {insights.fare_prediction.confidence.toFixed(1)}%)
                </p>
              )}
            </>
          ) : (
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '8px', 
              border: '1px solid #ffc107',
              textAlign: 'center',
              color: '#856404'
            }}>
              <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>No Fare History Trend Available</p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                This flight has no valid fare history records (all fares are NULL or zero). 
                The fare trend chart requires historical fare data with positive values to display trends.
              </p>
            </div>
          )}
        </div>

        {/* Reliability Score (only show when date is provided) */}
        {insights.has_target_date && insights.reliability && (
        <div style={{ 
          marginBottom: '30px', 
          padding: '20px', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '8px',
          border: `3px solid ${getReliabilityColor(insights.reliability.score)}`
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Reliability Analysis</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span><strong>Reliability Score:</strong></span>
                <span style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold',
                  color: getReliabilityColor(insights.reliability.score)
                }}>
                  {insights.reliability.score.toFixed(1)}%
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '20px', 
                backgroundColor: '#e0e0e0', 
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${insights.reliability.score}%`, 
                  height: '100%', 
                  backgroundColor: getReliabilityColor(insights.reliability.score),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
          <p><strong>Cancellation Probability:</strong> {insights.reliability.cancellation_probability.toFixed(1)}%</p>
          
          {insights.reliability.weather_data && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
              <strong>Weather Conditions:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {insights.reliability.weather_data.fog_flag && <li>Fog present</li>}
                {insights.reliability.weather_data.thunder_flag && <li>Thunderstorms possible</li>}
                {insights.reliability.weather_data.prcp_mm && (
                  <li>Precipitation: {insights.reliability.weather_data.prcp_mm}mm</li>
                )}
                {insights.reliability.weather_data.tmin_c !== null && (
                  <li>Min Temperature: {insights.reliability.weather_data.tmin_c}°C</li>
                )}
              </ul>
            </div>
          )}
        </div>
        )}

        {/* ML Predictions Table (when date is provided) */}
        {insights.has_target_date && insights.ml_predictions && (
          <div style={{ 
            marginBottom: '30px', 
            padding: '20px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '2px solid #007bff'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#007bff' }}>
              Machine Learning Predictions & Calculations
            </h3>
            
            <div style={{ marginBottom: '20px', overflowX: 'auto' }}>
              <table className="table" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#004085', color: '#fff', fontWeight: 'bold' }}>
                    {['Metric', 'Value', 'Calculation Method'].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: '12px',
                          border: '1px solid #002752',
                          backgroundColor: '#004085',
                          color: '#fff'
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Delay Probability</strong></td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
                      {insights.ml_predictions?.delay_probability?.toFixed(2) || 'N/A'}%
                    </td>
                    <td style={{ fontSize: '13px', color: '#666' }}>
                      Weighted ensemble: Airline reliability (25%) + Origin weather (20%) + 
                      Destination weather (20%) + Historical risk (15%) + Route popularity (10%) + Seasonal factor (10%)
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Cancellation Probability</strong></td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
                      {insights.ml_predictions?.cancellation_probability?.toFixed(2) || 'N/A'}%
                    </td>
                    <td style={{ fontSize: '13px', color: '#666' }}>
                      Delay probability (40%) + Weather conditions (50%) + Airline reliability (10%)
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Reliability Score</strong></td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold', color: getReliabilityColor(insights.ml_predictions?.reliability_score || 0) }}>
                      {insights.ml_predictions?.reliability_score?.toFixed(2) || 'N/A'}%
                    </td>
                    <td style={{ fontSize: '13px', color: '#666' }}>
                      Inverse of delay probability: (1 - delay_prob) × 100
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Prediction Confidence</strong></td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {insights.ml_predictions?.confidence?.toFixed(2) || 'N/A'}%
                    </td>
                    <td style={{ fontSize: '13px', color: '#666' }}>
                      Based on data quality and availability: Average of airline data quality, weather data quality, and historical data quality
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Feature Values Table */}
            {insights.ml_predictions?.features && Object.keys(insights.ml_predictions.features).length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#495057' }}>Feature Engineering Values</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#512da8', color: '#fff', fontWeight: 'bold' }}>
                        {['Feature', 'Value (0-1)', 'Weight', 'Description'].map((header) => (
                          <th
                            key={header}
                            style={{
                              padding: '12px',
                              border: '1px solid #311b92',
                              backgroundColor: '#512da8',
                              color: '#fff'
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(insights.ml_predictions?.features || {}).map(([key, value]) => {
                        const info = FEATURE_METADATA[key] || { desc: 'Feature value' }
                        return (
                          <tr key={key}>
                            <td><strong>{info.label || formatFeatureLabel(key)}</strong></td>
                            <td style={{ fontWeight: 'bold' }}>{value.toFixed(3)}</td>
                            <td>{info.weight !== undefined ? `${info.weight}%` : 'N/A'}</td>
                            <td style={{ fontSize: '12px', color: '#666' }}>{info.desc}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {featureChartData && (
              <div style={{ marginTop: '30px', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #cfe2ff', padding: '15px' }}>
                <h4 style={{ margin: '0 0 10px', color: '#495057' }}>Feature Influence Visualizer</h4>
                <p style={{ marginTop: 0, fontSize: '13px', color: '#666' }}>
                  Understand how each engineered feature drives the delay prediction model. Values and weights are scaled to percentages.
                </p>
                <div style={{ width: '100%', minHeight: '280px' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={featureChartData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <YAxis type="category" dataKey="feature" width={150} tick={{ fontSize: 12 }} />
                      <Legend />
                      <RechartsTooltip content={<FeatureTooltip />} />
                      <Bar dataKey="normalizedValue" name="Feature Value" fill="#28a745" barSize={14} radius={[4, 4, 4, 4]} />
                      <Bar dataKey="weight" name="Model Weight" fill="#ff9800" barSize={14} radius={[4, 4, 4, 4]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weather Analysis Table (when date is provided) */}
        {insights.has_target_date && insights.weather_analysis && (
          <div style={{ 
            marginBottom: '30px', 
            padding: '20px', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '8px',
            border: '2px solid #17a2b8'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#17a2b8' }}>
              Weather Analysis (Origin & Destination)
            </h3>

            {weatherChartData && (
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ marginBottom: '5px', color: '#0c5460' }}>Visual Weather Comparison</h4>
                <p style={{ marginTop: 0, marginBottom: '12px', fontSize: '13px', color: '#495057' }}>
                  Compare precipitation, snow, wind speed, cloud cover, and risk score for both airports.
                  Values are normalized to a 0-100 scale for a quick visual scan—hover to view actual numbers.
                </p>
                <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #d0e3ff', padding: '15px' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={weatherChartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip content={<WeatherTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="origin"
                        name={`Origin ${insights.flight.origin?.airport_code || ''}`}
                        fill="#1e88e5"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="destination"
                        name={`Destination ${insights.flight.destination?.airport_code || ''}`}
                        fill="#ff7043"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0056b3', color: '#fff', fontWeight: 'bold' }}>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Airport</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Risk Score</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Precipitation (mm)</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Snow (mm)</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Wind Speed (m/s)</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Min Temp (°C)</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Fog</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Thunder</th>
                    <th style={{ backgroundColor: '#0056b3', color: '#fff', padding: '12px', border: '1px solid #004085' }}>Cloud Cover</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.weather_analysis.origin && (
                    <tr>
                      <td><strong>Origin: {insights.flight.origin?.airport_code}</strong></td>
                      <td style={{ fontWeight: 'bold', color: insights.weather_analysis.origin.risk_score > 50 ? '#dc3545' : '#28a745' }}>
                        {insights.weather_analysis.origin.risk_score?.toFixed(1)}/100
                      </td>
                      <td>{insights.weather_analysis.origin.weather_data?.prcp_mm?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.origin.weather_data?.snow_mm?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.origin.weather_data?.wsf2_ms?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.origin.weather_data?.tmin_c?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.origin.weather_data?.fog_flag ? 'Yes' : 'No'}</td>
                      <td>{insights.weather_analysis.origin.weather_data?.thunder_flag ? 'Yes' : 'No'}</td>
                      <td>{(insights.weather_analysis.origin.weather_data?.cloud_day_frac * 100)?.toFixed(0) || 'N/A'}%</td>
                    </tr>
                  )}
                  {insights.weather_analysis.destination && (
                    <tr>
                      <td><strong>Destination: {insights.flight.destination?.airport_code}</strong></td>
                      <td style={{ fontWeight: 'bold', color: insights.weather_analysis.destination.risk_score > 50 ? '#dc3545' : '#28a745' }}>
                        {insights.weather_analysis.destination.risk_score?.toFixed(1)}/100
                      </td>
                      <td>{insights.weather_analysis.destination.weather_data?.prcp_mm?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.destination.weather_data?.snow_mm?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.destination.weather_data?.wsf2_ms?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.destination.weather_data?.tmin_c?.toFixed(1) || 'N/A'}</td>
                      <td>{insights.weather_analysis.destination.weather_data?.fog_flag ? 'Yes' : 'No'}</td>
                      <td>{insights.weather_analysis.destination.weather_data?.thunder_flag ? 'Yes' : 'No'}</td>
                      <td>{(insights.weather_analysis.destination.weather_data?.cloud_day_frac * 100)?.toFixed(0) || 'N/A'}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Historical Risk Factors */}
            {insights.weather_analysis.historical_risk && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '6px' }}>
                <h4 style={{ marginBottom: '10px', color: '#495057' }}>Historical Risk Analysis</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ backgroundColor: '#f8f9fa' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#343a40', color: '#fff', fontWeight: 'bold' }}>
                        <th style={{ backgroundColor: '#343a40', color: '#fff', padding: '12px', border: '1px solid #212529' }}>Analysis Type</th>
                        <th style={{ backgroundColor: '#343a40', color: '#fff', padding: '12px', border: '1px solid #212529' }}>Combined Risk Score</th>
                        <th style={{ backgroundColor: '#343a40', color: '#fff', padding: '12px', border: '1px solid #212529' }}>Origin Risk</th>
                        <th style={{ backgroundColor: '#343a40', color: '#fff', padding: '12px', border: '1px solid #212529' }}>Destination Risk</th>
                        <th style={{ backgroundColor: '#343a40', color: '#fff', padding: '12px', border: '1px solid #212529' }}>Data Points Used</th>
                        <th style={{ backgroundColor: '#343a40', color: '#fff', padding: '12px', border: '1px solid #212529' }}>Calculation Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>{insights.weather_analysis.historical_risk.analysis_type?.toUpperCase() || 'N/A'}</strong></td>
                        <td style={{ fontWeight: 'bold', fontSize: '16px' }}>
                          {insights.weather_analysis.historical_risk.combined_risk?.toFixed(1)}/100
                        </td>
                        <td>{insights.weather_analysis.origin?.risk_score?.toFixed(1) || 'N/A'}</td>
                        <td>{insights.weather_analysis.destination?.risk_score?.toFixed(1) || 'N/A'}</td>
                        <td>{insights.weather_analysis.historical_risk.data_points || 0}</td>
                        <td style={{ fontSize: '12px', color: '#666' }}>
                          {insights.weather_analysis.historical_risk.analysis_type === 'monthly' 
                            ? 'Monthly patterns across all years. Falls back to quarterly if <10 data points.'
                            : 'Quarterly patterns across all years (Q1-Q4).'}
                          <br />
                          Risk factors: Precipitation (0-20pts) + Snow (0-25pts) + Wind (0-15pts) + 
                          Fog (12pts) + Thunder (20pts) + Temperature (0-10pts) + Cloud (0-10pts)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alternative Flights Table (when date is provided) */}
        {insights.has_target_date && insights.alternatives && insights.alternatives.length > 0 && (
          <div style={{ 
            marginBottom: '30px', 
            padding: '20px', 
            backgroundColor: '#fff3cd', 
            borderRadius: '8px',
            border: '2px solid #ffc107'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#856404' }}>
              Alternative Flight Recommendations
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#ffc107', color: '#000' }}>
                    <th>Flight No</th>
                    <th>Airline ID</th>
                    <th>Reliability Score</th>
                    <th>Delay Risk</th>
                    <th>Recommendation Score</th>
                    <th>Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.alternatives.map((alt, idx) => (
                    <tr key={idx}>
                      <td><strong style={{ color: '#007bff' }}>{alt.flight_no}</strong></td>
                      <td>{alt.airline_id}</td>
                      <td style={{ fontWeight: 'bold', color: alt.reliability_score >= 80 ? '#28a745' : '#dc3545' }}>
                        {alt.reliability_score.toFixed(1)}%
                      </td>
                      <td style={{ fontWeight: 'bold', color: alt.delay_risk < 20 ? '#28a745' : '#dc3545' }}>
                        {alt.delay_risk.toFixed(1)}%
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{alt.recommendation_score.toFixed(1)}/100</td>
                      <td style={{ fontSize: '12px' }}>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {alt.reasons.map((reason, rIdx) => (
                            <li key={rIdx}>{reason}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '15px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
              <strong>Scoring Method:</strong> Reliability (0-40pts) + Comparison with original (0-20pts) + 
              Operations volume (0-20pts) + Airline preference (0-20pts). Higher score = better alternative.
            </p>
          </div>
        )}

        {/* Fare Prediction Details Table */}
        {insights.has_target_date && insights.fare_prediction && (
          <div style={{ 
            marginBottom: '30px', 
            padding: '20px', 
            backgroundColor: '#d1ecf1', 
            borderRadius: '8px',
            border: '2px solid #0c5460'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0c5460' }}>
              Fare Prediction Analysis
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#004d40', color: '#fff', fontWeight: 'bold' }}>
                    {['Metric', 'Value', 'Confidence', 'Calculation Method'].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: '12px',
                          border: '1px solid #00352c',
                          backgroundColor: '#004d40',
                          color: '#fff'
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Predicted Fare</strong></td>
                    <td style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                      ${insights.fare_prediction.predicted_fare?.toFixed(2) || 'N/A'}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {insights.fare_prediction.confidence?.toFixed(1) || 0}%
                    </td>
                    <td style={{ fontSize: '12px', color: '#666' }}>
                      <strong>Ensemble Method:</strong> Linear regression trend (40%) + 
                      Weighted moving average with exponential decay (30%) + 
                      Seasonal adjustment by quarter (30%)
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Current/Most Recent Fare</strong></td>
                    <td style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      ${insights.fare_prediction.current_fare?.toFixed(2) || 'N/A'}
                    </td>
                    <td>-</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>
                      Most recent fare from historical data
                    </td>
                  </tr>
                  {insights.fare_prediction.predicted_fare && insights.fare_prediction.current_fare && (
                    <tr>
                      <td><strong>Price Difference</strong></td>
                      <td style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        color: insights.fare_prediction.predicted_fare < insights.fare_prediction.current_fare ? '#28a745' : '#dc3545'
                      }}>
                        {insights.fare_prediction.predicted_fare < insights.fare_prediction.current_fare ? '-' : '+'}
                        ${Math.abs(insights.fare_prediction.predicted_fare - insights.fare_prediction.current_fare).toFixed(2)}
                      </td>
                      <td>-</td>
                      <td style={{ fontSize: '12px', color: '#666' }}>
                        {insights.fare_prediction.predicted_fare < insights.fare_prediction.current_fare 
                          ? 'Predicted fare is LOWER - Good time to book!' 
                          : 'Predicted fare is HIGHER - Consider waiting'}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td><strong>Confidence Calculation</strong></td>
                    <td colSpan="3" style={{ fontSize: '12px', color: '#666' }}>
                      Based on: Data quality (coefficient of variation) + Data quantity (number of historical records).
                      Higher variance = lower confidence. More data points = higher confidence.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Booking Recommendation (only show when date is provided) */}
        {insights.has_target_date && insights.recommendation && (
        <div style={{ 
          padding: '20px', 
          backgroundColor: getRecommendationColor(insights.recommendation.recommendation) === '#4CAF50' ? '#d4edda' :
                         getRecommendationColor(insights.recommendation.recommendation) === '#FF9800' ? '#fff3cd' : '#f8d7da',
          borderRadius: '8px',
          border: `3px solid ${getRecommendationColor(insights.recommendation.recommendation)}`
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Booking Recommendation</h3>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: getRecommendationColor(insights.recommendation.recommendation),
            marginBottom: '15px'
          }}>
            {insights.recommendation.recommendation}
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong>Decision Logic:</strong>
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px', fontSize: '13px' }}>
              <strong>HIGHLY RECOMMENDED:</strong> Reliability ≥70% AND Delay probability &lt;30% AND Cancellation probability &lt;15%<br />
              <strong>RECOMMENDED:</strong> Reliability ≥60%<br />
              <strong>BOOK WITH CAUTION:</strong> Reliability &lt;60% OR High delay/cancellation risk
            </div>
          </div>
          <div>
            <strong>Reasoning:</strong>
            {insights.recommendation.reasoning && insights.recommendation.reasoning.length > 0 ? (
              <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                {insights.recommendation.reasoning.map((reason, idx) => (
                  <li key={idx} style={{ marginBottom: '5px' }}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p style={{ marginTop: '10px', color: '#666', fontStyle: 'italic' }}>
                Based on current flight metrics and historical data analysis.
              </p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default FlightInsightsPage

