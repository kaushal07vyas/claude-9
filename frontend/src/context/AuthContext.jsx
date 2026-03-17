import React, { createContext, useState, useContext, useEffect } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  const isAdmin = () => {
    return user && user.role === 'Admin'  // Database uses 'Admin' and 'User' (ENUM)
  }

  const isRegular = () => {
    return user && user.role === 'User'  // Database uses 'Admin' and 'User' (ENUM)
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAdmin,
      isRegular,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

