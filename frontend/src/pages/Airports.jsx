import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { airportsApi } from '../api/airports'
import { dailyWeatherApi } from '../api/dailyWeather'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'

function Airports() {
  const { isAdmin } = useAuth()
  const [airports, setAirports] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAirport, setEditingAirport] = useState(null)
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false)
  const [selectedAirport, setSelectedAirport] = useState(null)
  const [weatherData, setWeatherData] = useState([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetchAirports = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      if (searchQuery) params.q = searchQuery
      const res = await airportsApi.list(params)
      setAirports(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch (error) {
      console.error('Error fetching airports:', error)
      alert(error.error?.message || 'Error fetching airports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAirports()
  }, [page, pageSize, searchQuery])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchAirports()
  }

  const onSubmit = async (data) => {
    try {
      if (editingAirport) {
        await airportsApi.update(editingAirport.airport_code, data)
      } else {
        await airportsApi.create(data)
      }
      setIsModalOpen(false)
      setEditingAirport(null)
      reset()
      fetchAirports()
    } catch (error) {
      alert(error.error?.message || 'Error saving airport')
    }
  }

  const handleEdit = (airport) => {
    setEditingAirport(airport)
    reset(airport)
    setIsModalOpen(true)
  }

  const handleDelete = async (airport) => {
    if (!window.confirm(`Are you sure you want to delete ${airport.airport_code}?`)) return
    try {
      await airportsApi.delete(airport.airport_code)
      fetchAirports()
    } catch (error) {
      alert(error.error?.message || 'Error deleting airport')
    }
  }

  const handleNew = () => {
    setEditingAirport(null)
    reset({ airport_code: '', airport_name: '', city: '', country: '' })
    setIsModalOpen(true)
  }

  const handleViewWeather = async (airport) => {
    setSelectedAirport(airport)
    setIsWeatherModalOpen(true)
    setWeatherLoading(true)
    setWeatherData([]) // Clear previous data
    try {
      const res = await dailyWeatherApi.list({ 
        station_id: airport.airport_code,
        page_size: 100 
      })
      // Sort by date descending (most recent first) with safe date parsing
      const sortedData = (res.data.data || []).sort((a, b) => {
        try {
          const dateA = a.date ? (typeof a.date === 'string' ? new Date(a.date) : a.date) : new Date(0)
          const dateB = b.date ? (typeof b.date === 'string' ? new Date(b.date) : b.date) : new Date(0)
          return dateB.getTime() - dateA.getTime()
        } catch (e) {
          console.error('Error sorting dates:', e)
          return 0
        }
      })
      setWeatherData(sortedData)
    } catch (error) {
      console.error('Error fetching weather data:', error)
      const errorMessage = error.response?.data?.error?.message || error.message || 'Error fetching weather data'
      alert(errorMessage)
      setWeatherData([])
    } finally {
      setWeatherLoading(false)
    }
  }

  const columns = [
    { key: 'airport_code', label: 'Code' },
    { key: 'airport_name', label: 'Name' },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
  ]

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Airports</h2>
        {isAdmin() && (
          <button className="btn btn-primary" onClick={handleNew}>
            Add New Airport
          </button>
        )}
      </div>

      <div className="search-bar">
        <form onSubmit={handleSearch} style={{ display: 'flex', flex: 1, gap: '12px' }}>
          <input
            type="text"
            placeholder="Search airports..."
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
            data={airports}
            onEdit={isAdmin() ? handleEdit : null}
            onDelete={isAdmin() ? handleDelete : null}
            onView={handleViewWeather}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingAirport(null)
          reset()
        }}
        title={editingAirport ? 'Edit Airport' : 'Add New Airport'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label>Airport Code *</label>
            <input
              {...register('airport_code', {
                required: 'Airport code is required',
                maxLength: { value: 3, message: 'Airport code must be 3 characters' },
                pattern: { value: /^[A-Z]{3}$/, message: 'Airport code must be 3 uppercase letters' }
              })}
              disabled={!!editingAirport}
              style={{ textTransform: 'uppercase' }}
            />
            {errors.airport_code && <div className="error">{errors.airport_code.message}</div>}
          </div>
          <div className="form-group">
            <label>Airport Name *</label>
            <input
              {...register('airport_name', { required: 'Airport name is required' })}
            />
            {errors.airport_name && <div className="error">{errors.airport_name.message}</div>}
          </div>
          <div className="form-group">
            <label>City *</label>
            <input
              {...register('city', { required: 'City is required' })}
            />
            {errors.city && <div className="error">{errors.city.message}</div>}
          </div>
          <div className="form-group">
            <label>Country *</label>
            <input
              {...register('country', { required: 'Country is required' })}
            />
            {errors.country && <div className="error">{errors.country.message}</div>}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary">
              {editingAirport ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsModalOpen(false)
                setEditingAirport(null)
                reset()
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Weather Details Modal */}
      <Modal
        isOpen={isWeatherModalOpen}
        onClose={() => {
          setIsWeatherModalOpen(false)
          setSelectedAirport(null)
          setWeatherData([])
        }}
        title={selectedAirport ? `Weather Details - ${selectedAirport.airport_code}` : 'Weather Details'}
      >
        {selectedAirport && (
          <div>
            <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(0, 123, 255, 0.1)', borderRadius: '8px' }}>
              <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                {selectedAirport.airport_name}
              </p>
              <p style={{ margin: '4px 0', color: '#666' }}>
                {selectedAirport.city}, {selectedAirport.country}
              </p>
            </div>

            {weatherLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading weather data...</div>
            ) : weatherData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <p>No weather data available for this airport.</p>
                {isAdmin() && (
                  <p style={{ fontSize: '14px', marginTop: '10px' }}>
                    You can add weather data from the Daily Weather page.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                  Showing {weatherData.length} weather record{weatherData.length !== 1 ? 's' : ''} for this airport
                </p>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="table" style={{ marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Precipitation (mm)</th>
                        <th>Snow (mm)</th>
                        <th>Wind Speed (m/s)</th>
                        <th>Gust (m/s)</th>
                        <th>Min Temp (°C)</th>
                        <th>Cloud Cover</th>
                        <th>Fog</th>
                        <th>Thunder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weatherData.map((weather, idx) => {
                        // Safely parse date
                        let dateDisplay = 'N/A'
                        try {
                          if (weather.date) {
                            const dateObj = typeof weather.date === 'string' ? new Date(weather.date) : weather.date
                            if (!isNaN(dateObj.getTime())) {
                              dateDisplay = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                            }
                          }
                        } catch (e) {
                          console.error('Error parsing date:', e, weather.date)
                          dateDisplay = weather.date || 'N/A'
                        }

                        // Safely format numeric values
                        const formatNumber = (value) => {
                          if (value === null || value === undefined) return 'N/A'
                          try {
                            const num = typeof value === 'string' ? parseFloat(value) : value
                            return isNaN(num) ? 'N/A' : num.toFixed(1)
                          } catch (e) {
                            return 'N/A'
                          }
                        }

                        return (
                        <tr key={idx}>
                            <td><strong>{dateDisplay}</strong></td>
                            <td>{formatNumber(weather.prcp_mm)}</td>
                            <td>{formatNumber(weather.snow_mm)}</td>
                            <td>{formatNumber(weather.awwnd_ms)}</td>
                            <td>{formatNumber(weather.gust_ms)}</td>
                            <td>{formatNumber(weather.tmin_c)}</td>
                          <td>
                            {weather.cloud_day_frac !== null && weather.cloud_day_frac !== undefined 
                                ? `${(parseFloat(weather.cloud_day_frac) * 100).toFixed(0)}%` 
                              : 'N/A'}
                          </td>
                          <td>
                            <span style={{ 
                              color: weather.fog_flag ? '#dc3545' : '#28a745',
                              fontWeight: 'bold'
                            }}>
                              {weather.fog_flag ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <span style={{ 
                              color: weather.thunder_flag ? '#dc3545' : '#28a745',
                              fontWeight: 'bold'
                            }}>
                              {weather.thunder_flag ? 'Yes' : 'No'}
                            </span>
                          </td>
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
      </Modal>
    </div>
  )
}

export default Airports

