import React, { useState, useEffect, useRef, useCallback } from 'react'
import { flightInsightsApi } from '../api/flightInsights'
import Modal from './Modal'

function FlightInsights({ flightId, isOpen, onClose, targetDate = null }) {
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(targetDate || '')
  const canvasRef = useRef(null)

  const fetchInsights = async () => {
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
    if (isOpen && flightId) {
      fetchInsights()
    } else {
      // Reset insights when modal closes
      setInsights(null)
      setSelectedDate(targetDate || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, flightId, targetDate, selectedDate])

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

    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.log('Could not get canvas context')
        return
      }

      const width = canvas.width
      const height = canvas.height
      const padding = { top: 40, right: 40, bottom: 60, left: 80 }

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Get fare data
      const fareData = insights.fare_trend.filter(d => d.fare !== null && d.fare !== undefined)
      
      if (fareData.length === 0) {
        console.log('No valid fare data points')
        return
      }

      console.log('Drawing chart with', fareData.length, 'data points')

      // Calculate scales
      const minFare = Math.min(...fareData.map(d => d.fare))
      const maxFare = Math.max(...fareData.map(d => d.fare))
      const fareRange = maxFare - minFare || 1
      const farePadding = fareRange * 0.1

      const chartWidth = width - padding.left - padding.right
      const chartHeight = height - padding.top - padding.bottom

      // Draw axes
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2

      // Y-axis
      ctx.beginPath()
      ctx.moveTo(padding.left, padding.top)
      ctx.lineTo(padding.left, height - padding.bottom)
      ctx.stroke()

      // X-axis
      ctx.beginPath()
      ctx.moveTo(padding.left, height - padding.bottom)
      ctx.lineTo(width - padding.right, height - padding.bottom)
      ctx.stroke()

      // Draw grid lines and labels
      ctx.strokeStyle = '#ddd'
      ctx.lineWidth = 1
      ctx.fillStyle = '#666'
      ctx.font = '12px Arial'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      // Y-axis grid and labels
      const ySteps = 5
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (chartHeight / ySteps) * i
        const fareValue = maxFare + farePadding - ((maxFare - minFare + farePadding * 2) / ySteps) * i

        // Grid line
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.stroke()

        // Label
        ctx.fillText(`$${fareValue.toFixed(0)}`, padding.left - 10, y)
      }

      // X-axis labels
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      fareData.forEach((d, i) => {
        const x = padding.left + (chartWidth / (fareData.length - 1 || 1)) * i
        ctx.fillText(d.date || `${d.year}-Q${d.quarter}`, x, height - padding.bottom + 10)
      })

      // Draw trend line
      ctx.strokeStyle = '#4CAF50'
      ctx.lineWidth = 3
      ctx.beginPath()

      fareData.forEach((d, i) => {
        const x = padding.left + (chartWidth / (fareData.length - 1 || 1)) * i
        const normalizedFare = (d.fare - minFare + farePadding) / (maxFare - minFare + farePadding * 2)
        const y = height - padding.bottom - (normalizedFare * chartHeight)

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // Draw data points
      ctx.fillStyle = '#4CAF50'
      fareData.forEach((d, i) => {
        const x = padding.left + (chartWidth / (fareData.length - 1 || 1)) * i
        const normalizedFare = (d.fare - minFare + farePadding) / (maxFare - minFare + farePadding * 2)
        const y = height - padding.bottom - (normalizedFare * chartHeight)

        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()

        // Show fare value
        ctx.fillStyle = '#fff'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`$${d.fare.toFixed(2)}`, x, y - 15)
        ctx.fillStyle = '#4CAF50'
      })

      // Draw predicted fare if available
      if (insights.fare_prediction?.predicted_fare) {
        const predictedFare = insights.fare_prediction.predicted_fare
        const normalizedPredicted = (predictedFare - minFare + farePadding) / (maxFare - minFare + farePadding * 2)
        const predictedY = height - padding.bottom - (normalizedPredicted * chartHeight)
        const predictedX = width - padding.right

        // Draw dashed line for prediction
        ctx.strokeStyle = '#FF9800'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(padding.left, predictedY)
        ctx.lineTo(predictedX, predictedY)
        ctx.stroke()
        ctx.setLineDash([])

        // Label for prediction
        ctx.fillStyle = '#FF9800'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(`Predicted: $${predictedFare.toFixed(2)}`, predictedX - 10, predictedY)
      }

      // Chart title
      ctx.fillStyle = '#333'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('Fare History Trend', width / 2, 10)

      console.log('Chart drawn successfully')
    } catch (error) {
      console.error('Error drawing chart:', error)
    }
  }, [insights])

  useEffect(() => {
    if (insights && insights.fare_trend && insights.fare_trend.length > 0 && isOpen) {
      // Wait a bit for the canvas to be fully rendered
      const timer = setTimeout(() => {
        drawChart()
      }, 200)

      // Redraw chart when window resizes
      const handleResize = () => {
        setTimeout(() => drawChart(), 100)
      }
      window.addEventListener('resize', handleResize)
      
      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [insights, isOpen, drawChart])

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value)
  }

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

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Flight Insights & Analysis">
      {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading insights...</div>}
      
      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {insights && !loading && (
        <div style={{ maxWidth: '100%', overflow: 'auto' }}>
          {/* Flight Information */}
          <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Flight Information</h3>
            <p><strong>Flight:</strong> {insights.flight.flight_no}</p>
            <p><strong>Airline:</strong> {insights.flight.airline?.airline_name || insights.flight.airline_id}</p>
            <p><strong>Route:</strong> {insights.flight.origin?.airport_code} → {insights.flight.destination?.airport_code}</p>
            
            {/* Date Input */}
            <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #ddd' }}>
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
                        onClick={() => setSelectedDate(suggestion.start_date)}
                        style={{
                          marginTop: '10px',
                          padding: '6px 12px',
                          backgroundColor: '#2196F3',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Analyze This Period
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
                📊 Complete Insights Summary
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#28a745', color: '#fff' }}>
                      <th>Category</th>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Status</th>
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
                backgroundColor: '#f9f9f9', 
                borderRadius: '8px', 
                border: '1px solid #ddd',
                textAlign: 'center',
                color: '#666'
              }}>
                <p>No fare history data available for this flight.</p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  Fare trend visualization requires historical fare data.
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

          {/* Fare Prediction (only show when date is provided) */}
          {insights.has_target_date && insights.fare_prediction && (
            <div style={{ 
              marginBottom: '30px', 
              padding: '20px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '8px',
              border: '2px solid #ffc107'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Fare Prediction</h3>
              {insights.fare_prediction.predicted_fare ? (
                <>
                  <p><strong>Predicted Fare:</strong> ${insights.fare_prediction.predicted_fare.toFixed(2)}</p>
                  {insights.fare_prediction.current_fare && (
                    <>
                      <p><strong>Current/Most Recent Fare:</strong> ${insights.fare_prediction.current_fare.toFixed(2)}</p>
                      <p>
                        <strong>Difference:</strong> 
                        {insights.fare_prediction.current_fare > insights.fare_prediction.predicted_fare ? (
                          <span style={{ color: '#d32f2f' }}>
                            ${(insights.fare_prediction.current_fare - insights.fare_prediction.predicted_fare).toFixed(2)} above prediction
                          </span>
                        ) : (
                          <span style={{ color: '#388e3c' }}>
                            ${(insights.fare_prediction.predicted_fare - insights.fare_prediction.current_fare).toFixed(2)} below prediction (Good deal!)
                          </span>
                        )}
                      </p>
                    </>
                  )}
                  <p><strong>Confidence:</strong> {insights.fare_prediction.confidence.toFixed(1)}%</p>
                </>
              ) : (
                <p>Insufficient historical data for fare prediction</p>
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
                    <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Calculation Method</th>
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
                        <tr style={{ backgroundColor: '#6c757d', color: '#fff' }}>
                          <th>Feature</th>
                          <th>Value (0-1)</th>
                          <th>Weight</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(insights.ml_predictions?.features || {}).map(([key, value]) => {
                          const featureInfo = {
                            'airline_reliability': { weight: '25%', desc: 'Based on airline cancellation history (1.0 = most reliable)' },
                            'weather_origin': { weight: '20%', desc: 'Weather risk at origin airport (0.0 = best weather)' },
                            'weather_dest': { weight: '20%', desc: 'Weather risk at destination airport (0.0 = best weather)' },
                            'historical_risk': { weight: '15%', desc: 'Historical monthly/quarterly weather patterns' },
                            'route_popularity': { weight: '10%', desc: 'Based on total operations (more ops = more reliable data)' },
                            'seasonal_factor': { weight: '10%', desc: 'Seasonal adjustment (winter=0.6, summer=0.4, others=0.5)' }
                          }
                          const info = featureInfo[key] || { weight: 'N/A', desc: 'Feature value' }
                          return (
                            <tr key={key}>
                              <td><strong>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong></td>
                              <td style={{ fontWeight: 'bold' }}>{value.toFixed(3)}</td>
                              <td>{info.weight}</td>
                              <td style={{ fontSize: '12px', color: '#666' }}>{info.desc}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
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
              
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ backgroundColor: '#fff', borderRadius: '6px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#17a2b8', color: '#fff' }}>
                      <th>Airport</th>
                      <th>Risk Score</th>
                      <th>Precipitation (mm)</th>
                      <th>Snow (mm)</th>
                      <th>Wind Speed (m/s)</th>
                      <th>Min Temp (°C)</th>
                      <th>Fog</th>
                      <th>Thunder</th>
                      <th>Cloud Cover</th>
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
                        <tr style={{ backgroundColor: '#6c757d', color: '#fff' }}>
                          <th>Analysis Type</th>
                          <th>Combined Risk Score</th>
                          <th>Origin Risk</th>
                          <th>Destination Risk</th>
                          <th>Data Points Used</th>
                          <th>Calculation Method</th>
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
                    <tr style={{ backgroundColor: '#0c5460', color: '#fff' }}>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Confidence</th>
                      <th>Calculation Method</th>
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
              <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                {insights.recommendation.reasoning.map((reason, idx) => (
                  <li key={idx} style={{ marginBottom: '5px' }}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', textAlign: 'right' }}>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}

export default FlightInsights

