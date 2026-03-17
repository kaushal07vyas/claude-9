import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { flightsApi } from '../api/flights'
import { flightInsightsApi } from '../api/flightInsights'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import FlightInsights from '../components/FlightInsights'

function Flights() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [flights, setFlights] = useState([])
  const [flightDetails, setFlightDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [priceGuidance, setPriceGuidance] = useState(null)
  const [delayRisk, setDelayRisk] = useState(null)
  const [insightsFlightId, setInsightsFlightId] = useState(null)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)

  useEffect(() => {
    if (id) {
      fetchFlightDetails(id)
    } else {
      fetchFlights()
    }
  }, [id, page, pageSize, searchQuery])

  const fetchFlights = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      if (searchQuery) params.q = searchQuery
      const res = await flightsApi.list(params)
      setFlights(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch (error) {
      console.error('Error fetching flights:', error)
      alert(error.error?.message || 'Error fetching flights')
    } finally {
      setLoading(false)
    }
  }

  const fetchFlightDetails = async (flightId) => {
    setLoading(true)
    try {
      const res = await flightsApi.get(flightId)
      setFlightDetails(res.data.data)
      
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
      navigate('/flights')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (flight) => {
    if (!window.confirm(`Are you sure you want to delete flight ${flight.flight_no}?`)) return
    try {
      await flightsApi.delete(flight.flight_id)
      fetchFlights()
    } catch (error) {
      alert(error.error?.message || 'Error deleting flight')
    }
  }

  const handleViewDetails = (flight) => {
    setInsightsFlightId(flight.flight_id)
    setIsInsightsOpen(true)
  }

  if (id && flightDetails) {
    return (
      <div className="container">
        <button className="btn btn-secondary" onClick={() => navigate('/flights')} style={{ marginBottom: '20px' }}>
          ← Back to Flights
        </button>
        <div className="card">
          <h2>Flight Details: {flightDetails.flight_no}</h2>
          <div style={{ marginTop: '20px' }}>
            <p><strong>Airline:</strong> {flightDetails.airline?.airline_name}</p>
            <p><strong>Origin:</strong> {flightDetails.origin?.airport_code} - {flightDetails.origin?.airport_name}</p>
            <p><strong>Destination:</strong> {flightDetails.destination?.airport_code} - {flightDetails.destination?.airport_name}</p>
            <p><strong>Total Operations:</strong> {flightDetails.total_ops}</p>
            <p><strong>Cancelled:</strong> {flightDetails.num_cancelled}</p>
          </div>
          
          {priceGuidance && (
            <div className="card" style={{ marginTop: '20px', backgroundColor: priceGuidance.should_wait ? '#fff3cd' : '#d4edda' }}>
              <h3>Price Guidance</h3>
              <p><strong>Should Wait:</strong> {priceGuidance.should_wait ? 'Yes' : 'No'}</p>
              <p><strong>Confidence:</strong> {priceGuidance.confidence}</p>
              {priceGuidance.current_fare && <p><strong>Current Fare:</strong> ${priceGuidance.current_fare.toFixed(2)}</p>}
            </div>
          )}
          
          {delayRisk && (
            <div className="card" style={{ marginTop: '20px', backgroundColor: delayRisk.risk === 'high' ? '#f8d7da' : delayRisk.risk === 'medium' ? '#fff3cd' : '#d4edda' }}>
              <h3>Delay Risk</h3>
              <p><strong>Risk Level:</strong> {delayRisk.risk}</p>
              {delayRisk.risk_score !== undefined && <p><strong>Risk Score:</strong> {delayRisk.risk_score}</p>}
            </div>
          )}
        </div>
      </div>
    )
  }

  const columns = [
    { key: 'flight_no', label: 'Flight No' },
    { key: 'airline_id', label: 'Airline ID' },
    { key: 'origin_airport', label: 'Origin' },
    { key: 'destination_airport', label: 'Destination' },
    { key: 'total_ops', label: 'Total Ops' },
    { key: 'num_cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Flights</h2>
      </div>

      <div className="search-bar">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchFlights(); }} style={{ display: 'flex', flex: 1, gap: '12px' }}>
          <input
            type="text"
            placeholder="Search flights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={flights}
            onEdit={null}
            onDelete={isAdmin() ? handleDelete : null}
            onView={(flight) => navigate(`/flights/${flight.flight_id}`)}
            onViewDetails={handleViewDetails}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setPage(1)
            }}
          />
        </>
      )}

      <FlightInsights
        flightId={insightsFlightId}
        isOpen={isInsightsOpen}
        onClose={() => {
          setIsInsightsOpen(false)
          setInsightsFlightId(null)
        }}
      />
    </div>
  )
}

export default Flights

