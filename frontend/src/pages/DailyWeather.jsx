import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { dailyWeatherApi } from '../api/dailyWeather'
import { airportsApi } from '../api/airports'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'

function DailyWeather() {
  const [weather, setWeather] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [airports, setAirports] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    airportsApi.list({ page_size: 100 }).then((res) => setAirports(res.data.data || []))
  }, [])

  const fetchWeather = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      const res = await dailyWeatherApi.list(params)
      setWeather(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch (error) {
      console.error('Error fetching weather:', error)
      alert(error.error?.message || 'Error fetching weather')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [page, pageSize])

  const onSubmit = async (data) => {
    try {
      // Convert fog_flag and thunder_flag properly
      const convertFlag = (value) => {
        if (value === true || value === 1 || value === '1') return true
        if (value === false || value === 0 || value === '0') return false
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1' || value === 'yes'
        }
        return Boolean(value)
      }
      
      const payload = {
        ...data,
        prcp_mm: data.prcp_mm ? parseFloat(data.prcp_mm) : null,
        snow_mm: data.snow_mm ? parseFloat(data.snow_mm) : null,
        snow_depth_mm: data.snow_depth_mm ? parseFloat(data.snow_depth_mm) : null,
        awwnd_ms: data.awwnd_ms ? parseFloat(data.awwnd_ms) : null,
        wsf2_ms: data.wsf2_ms ? parseFloat(data.wsf2_ms) : null,
        gust_ms: data.gust_ms ? parseFloat(data.gust_ms) : null,
        tmin_c: data.tmin_c ? parseFloat(data.tmin_c) : null,
        cloud_day_frac: data.cloud_day_frac ? parseFloat(data.cloud_day_frac) : null,
        fog_flag: convertFlag(data.fog_flag),
        thunder_flag: convertFlag(data.thunder_flag),
      }
      
      if (editingRecord) {
        await dailyWeatherApi.update(
          editingRecord.station_id,
          editingRecord.date,
          payload
        )
      } else {
        await dailyWeatherApi.create(payload)
      }
      setIsModalOpen(false)
      setEditingRecord(null)
      reset()
      fetchWeather()
    } catch (error) {
      alert(error.error?.message || 'Error saving weather')
    }
  }

  const handleEdit = (record) => {
    setEditingRecord(record)
    // Convert boolean flags to string for select dropdowns
    reset({ 
      ...record, 
      date: record.date,
      fog_flag: record.fog_flag ? 'true' : 'false',
      thunder_flag: record.thunder_flag ? 'true' : 'false'
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (record) => {
    if (!window.confirm(`Are you sure you want to delete this weather record?`)) return
    try {
      await dailyWeatherApi.delete(record.station_id, record.date)
      fetchWeather()
    } catch (error) {
      alert(error.error?.message || 'Error deleting weather')
    }
  }

  const handleNew = () => {
    setEditingRecord(null)
    const today = new Date().toISOString().split('T')[0]
    reset({
      date: today,
      station_id: '',
      prcp_mm: '',
      snow_mm: '',
      snow_depth_mm: '',
      awwnd_ms: '',
      wsf2_ms: '',
      gust_ms: '',
      tmin_c: '',
      cloud_day_frac: '',
      fog_flag: false,
      thunder_flag: false,
    })
    setIsModalOpen(true)
  }

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'station_id', label: 'Station ID' },
    { key: 'prcp_mm', label: 'Precipitation (mm)', render: (val) => val ?? '-' },
    { key: 'snow_mm', label: 'Snow (mm)', render: (val) => val ?? '-' },
    { key: 'tmin_c', label: 'Min Temp (°C)', render: (val) => val ?? '-' },
    { key: 'fog_flag', label: 'Fog', render: (val) => val ? 'Yes' : 'No' },
    { key: 'thunder_flag', label: 'Thunder', render: (val) => val ? 'Yes' : 'No' },
  ]

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Daily Weather</h2>
        <button className="btn btn-primary" onClick={handleNew}>
          Add New Weather Record
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={weather}
            onEdit={handleEdit}
            onDelete={handleDelete}
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
          setEditingRecord(null)
          reset()
        }}
        title={editingRecord ? 'Edit Weather Record' : 'Add New Weather Record'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              disabled={!!editingRecord}
            />
            {errors.date && <div className="error">{errors.date.message}</div>}
          </div>
          <div className="form-group">
            <label>Station ID (Airport Code) *</label>
            <select
              {...register('station_id', { required: 'Station ID is required' })}
              disabled={!!editingRecord}
            >
              <option value="">Select Airport</option>
              {airports.map((ap) => (
                <option key={ap.airport_code} value={ap.airport_code}>
                  {ap.airport_code} - {ap.airport_name}
                </option>
              ))}
            </select>
            {errors.station_id && <div className="error">{errors.station_id.message}</div>}
          </div>
          <div className="form-group">
            <label>Precipitation (mm)</label>
            <input type="number" step="0.01" {...register('prcp_mm')} />
          </div>
          <div className="form-group">
            <label>Snow (mm)</label>
            <input type="number" step="0.01" {...register('snow_mm')} />
          </div>
          <div className="form-group">
            <label>Snow Depth (mm)</label>
            <input type="number" step="0.01" {...register('snow_depth_mm')} />
          </div>
          <div className="form-group">
            <label>Average Wind Speed (m/s)</label>
            <input type="number" step="0.01" {...register('awwnd_ms')} />
          </div>
          <div className="form-group">
            <label>Wind Speed Fastest 2-min (m/s)</label>
            <input type="number" step="0.01" {...register('wsf2_ms')} />
          </div>
          <div className="form-group">
            <label>Wind Gust (m/s)</label>
            <input type="number" step="0.01" {...register('gust_ms')} />
          </div>
          <div className="form-group">
            <label>Min Temperature (°C)</label>
            <input type="number" step="0.01" {...register('tmin_c')} />
          </div>
          <div className="form-group">
            <label>Cloud Day Fraction (0-1)</label>
            <input type="number" step="0.01" min="0" max="1" {...register('cloud_day_frac')} />
          </div>
          <div className="form-group">
            <label>Fog Flag</label>
            <select {...register('fog_flag')}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="form-group">
            <label>Thunder Flag</label>
            <select {...register('thunder_flag')}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary">
              {editingRecord ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsModalOpen(false)
                setEditingRecord(null)
                reset()
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default DailyWeather

