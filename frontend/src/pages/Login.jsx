import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import { useForm } from 'react-hook-form'
import './Login.css'

function Login() {
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onLogin = async (data) => {
    try {
      setError('')
      const res = await authApi.login(data.email, data.password)
      if (res.data && res.data.data && res.data.data.user) {
        login(res.data.data.user)
        navigate('/')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Login failed. Please check your credentials.')
    }
  }

  const onSignup = async (data) => {
    try {
      setError('')
      const res = await authApi.signup(data)
      if (res.data && res.data.data && res.data.data.user) {
        login(res.data.data.user)
        navigate('/')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Signup failed. Please try again.')
    }
  }

  return (
    <div className="login-page-wrapper">
      <div className="login-overlay"></div>
      <div className="login-container">
        {/* App Introduction Section */}
        <div className="login-card login-intro-card">
          <div className="login-logo">
            <h1 className="login-title">Claude-9 Flight Tracker</h1>
          </div>
          <p className="login-tagline">Smart Flight Tracking & Booking Intelligence</p>
          <div className="login-features">
            <div className="login-feature-item">
              <span><strong>Flight Search & Tracking</strong> - Find and track flights effortlessly</span>
            </div>
            <div className="login-feature-item">
              <span><strong>Price Prediction</strong> - Get booking recommendations based on fare trends</span>
            </div>
            <div className="login-feature-item">
              <span><strong>Delay Warnings</strong> - Receive alerts about potential delays based on weather and flight history</span>
            </div>
            <div className="login-feature-item">
              <span><strong>Smart Routing</strong> - Discover alternate routes to avoid crowded or high-risk airports</span>
            </div>
          </div>
        </div>

        {/* Login/Signup Form */}
        <div className="login-card login-form-card">
          <h2 className="login-form-title">
            {isSignup ? 'Create Your Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {!isSignup ? (
            <form onSubmit={handleSubmit(onLogin)} className="login-form">
              <div className="login-form-group">
                <label className="login-label">Email</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' }
                  })}
                />
                {errors.email && <div className="login-error-text">{errors.email.message}</div>}
              </div>
              <div className="login-form-group">
                <label className="login-label">Password</label>
                <div className="login-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="Password"
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && <div className="login-error-text">{errors.password.message}</div>}
              </div>
              <button type="submit" className="login-btn-primary">
                Log in
              </button>
              <div className="login-signup-link">
                <span>Don't have an account? </span>
                <button
                  type="button"
                  className="login-link-button"
                  onClick={() => setIsSignup(true)}
                >
                  Sign up
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSignup)} className="login-form">
              <div className="login-form-group">
                <label className="login-label">Name</label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Name"
                  {...register('user_name', { required: 'Name is required' })}
                />
                {errors.user_name && <div className="login-error-text">{errors.user_name.message}</div>}
              </div>
              <div className="login-form-group">
                <label className="login-label">Email</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Email"
                  {...register('user_email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' }
                  })}
                />
                {errors.user_email && <div className="login-error-text">{errors.user_email.message}</div>}
              </div>
              <div className="login-form-group">
                <label className="login-label">Password</label>
                <div className="login-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="Password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Password must be at least 6 characters' }
                    })}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && <div className="login-error-text">{errors.password.message}</div>}
              </div>
              <div className="login-form-group">
                <label className="login-label">Date of Birth</label>
                <input
                  type="date"
                  className="login-input"
                  {...register('dob', { required: 'Date of birth is required' })}
                />
                {errors.dob && <div className="login-error-text">{errors.dob.message}</div>}
              </div>
              <div className="login-form-group">
                <label className="login-label">Phone Number</label>
                <input
                  type="tel"
                  className="login-input"
                  placeholder="Phone Number"
                  {...register('phone_number')}
                />
              </div>
              <div className="login-form-group">
                <label className="login-label">State</label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="State"
                  {...register('state')}
                />
              </div>
              <div className="login-form-group">
                <label className="login-label">Country</label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Country"
                  {...register('country', { required: 'Country is required' })}
                />
                {errors.country && <div className="login-error-text">{errors.country.message}</div>}
              </div>
              <button type="submit" className="login-btn-primary">
                Sign Up
              </button>
              <div className="login-signup-link">
                <span>Already have an account? </span>
                <button
                  type="button"
                  className="login-link-button"
                  onClick={() => setIsSignup(false)}
                >
                  Login
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Demo Credentials */}
        <div className="login-card login-demo-card">
          <p className="login-demo-title">Demo Credentials</p>
          <div className="login-demo-credentials">
            <div className="login-demo-item">
              <span className="login-demo-label">Admin</span>
              <span className="login-demo-text">admin@example.com / admin123</span>
            </div>
            <div className="login-demo-item">
              <span className="login-demo-label">User</span>
              <span className="login-demo-text">john.doe@example.com / user123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

