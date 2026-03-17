import React from 'react'

function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.ceil(total / pageSize)
  
  return (
    <div className="pagination">
      <button onClick={() => onPageChange(1)} disabled={page === 1}>
        First
      </button>
      <button onClick={() => onPageChange(page - 1)} disabled={page === 1}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages || 1} (Total: {total})
      </span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next
      </button>
      <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
        Last
      </button>
      <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
        <option value={10}>10 per page</option>
        <option value={20}>20 per page</option>
        <option value={50}>50 per page</option>
        <option value={100}>100 per page</option>
      </select>
    </div>
  )
}

export default Pagination

