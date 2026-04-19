import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

// Routes
import authRoutes from './routes/auth.js'
import characterRoutes from './routes/character.js'
import conversationRoutes from './routes/conversation.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/conversations', conversationRoutes)

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
app.listen(PORT, () => {
  console.log(`Echo Moon API server running on port ${PORT}`)
})

export default app
