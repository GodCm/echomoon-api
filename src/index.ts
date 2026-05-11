import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bodyParser from 'body-parser'

// Routes
import authRoutes from './routes/auth.js'
import characterRoutes from './routes/character.js'
import conversationRoutes from './routes/conversation.js'
import creemRoutes from './routes/creem.js'

dotenv.config()

const app = express()

// CORS configuration - allow frontend domains
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.echomoon.it.com'
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  'https://echomoon.it.com',
  'https://www.echomoon.it.com',
  'http://localhost:5173',
  'http://localhost:3000',
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    console.warn(`CORS blocked request from origin: ${origin}`)
    callback(new Error('CORS policy: origin not allowed'))
  },
  credentials: true,
}))

// Middleware for raw body (needed for Creem webhook signature verification)
// This must be before express.json() for the webhook route
app.use('/api/creem/webhook', bodyParser.raw({ type: 'application/json' }))

// Regular JSON parsing for other routes
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/creem', creemRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || ''

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((error) => console.error('MongoDB connection error:', error))
} else {
  console.log('MongoDB URI not provided. Running in demo mode.')
}

// Start server
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Echo Moon API server running on port ${PORT}`)
})

export default app
