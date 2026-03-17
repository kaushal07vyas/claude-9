import React from 'react'

function DataTable({ columns, data, onEdit, onDelete, onView, onViewDetails, actions = true }) {
  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} style={{ textAlign: 'center', padding: '20px' }}>
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {onViewDetails && (
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => onViewDetails(row)}
                          style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8' }}
                        >
                          View Details
                        </button>
                      )}
                      {onView && (
                        <button className="btn btn-secondary" onClick={() => onView(row)}>
                          View
                        </button>
                      )}
                      {onEdit && (
                        <button className="btn btn-primary" onClick={() => onEdit(row)}>
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button className="btn btn-danger" onClick={() => onDelete(row)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable

