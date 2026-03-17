import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { airlinesApi } from '../api/airlines'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'

function Airlines() {
  const { isAdmin } = useAuth()
  const [airlines, setAirlines] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAirline, setEditingAirline] = useState(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetchAirlines = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      if (searchQuery) params.q = searchQuery
      const res = await airlinesApi.list(params)
      setAirlines(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch (error) {
      console.error('Error fetching airlines:', error)
      alert(error.error?.message || 'Error fetching airlines')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAirlines()
  }, [page, pageSize, searchQuery])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchAirlines()
  }

  const onSubmit = async (data) => {
    try {
      if (editingAirline) {
        await airlinesApi.update(editingAirline.airline_id, data)
      } else {
        await airlinesApi.create(data)
      }
      setIsModalOpen(false)
      setEditingAirline(null)
      reset()
      fetchAirlines()
    } catch (error) {
      alert(error.error?.message || 'Error saving airline')
    }
  }

  const handleEdit = (airline) => {
    setEditingAirline(airline)
    reset(airline)
    setIsModalOpen(true)
  }

  const handleDelete = async (airline) => {
    if (!window.confirm(`Are you sure you want to delete ${airline.airline_name}?`)) return
    try {
      await airlinesApi.delete(airline.airline_id)
      fetchAirlines()
    } catch (error) {
      alert(error.error?.message || 'Error deleting airline')
    }
  }

  const handleNew = () => {
    setEditingAirline(null)
    reset({ airline_name: '' })
    setIsModalOpen(true)
  }

  const columns = [
    { key: 'airline_id', label: 'ID' },
    { key: 'airline_name', label: 'Airline Name' },
  ]

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Airlines</h2>
        {isAdmin() && (
          <button className="btn btn-primary" onClick={handleNew}>
            Add New Airline
          </button>
        )}
      </div>

      <div className="search-bar">
        <form onSubmit={handleSearch} style={{ display: 'flex', flex: 1, gap: '12px' }}>
          <input
            type="text"
            placeholder="Search airlines..."
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
            data={airlines}
            onEdit={isAdmin() ? handleEdit : null}
            onDelete={isAdmin() ? handleDelete : null}
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
          setEditingAirline(null)
          reset()
        }}
        title={editingAirline ? 'Edit Airline' : 'Add New Airline'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label>Airline Name *</label>
            <input
              {...register('airline_name', { required: 'Airline name is required' })}
            />
            {errors.airline_name && <div className="error">{errors.airline_name.message}</div>}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary">
              {editingAirline ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsModalOpen(false)
                setEditingAirline(null)
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

export default Airlines

