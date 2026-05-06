import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import 'dotenv/config'
import User from '../models/User.js'
import Character from '../models/Character.js'
import Conversation from '../models/Conversation.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret'

// Register (kept for backwards compatibility - new users use Clerk)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({
      email,
      password: hashedPassword,
      name,
      provider: 'email'
    })

    await user.save()

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        subscription: user.subscription
      }
    })
  } catch (error: any) {
    console.error('Register error:', error)
    res.status(500).json({ error: error.message || 'Registration failed' })
  }
})

// Login (kept for backwards compatibility)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        subscription: user.subscription
      }
    })
  } catch (error: any) {
    console.error('Login error:', error)
    res.status(500).json({ error: error.message || 'Login failed' })
  }
})

// Get current user - Clerk auth
// authMiddleware already verified the Clerk JWT and set req.clerkUserId
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const clerkUserId = req.clerkUserId!

    // Decode token to get email/name (already verified by middleware)
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1] || ''
    let email = ''
    let name = ''
    if (token) {
      const decoded = jwt.decode(token) as { email?: string; email_address?: string; name?: string; given_name?: string; first_name?: string } | null
      if (decoded) {
        email = decoded.email || decoded.email_address || ''
        name = decoded.name || decoded.given_name || decoded.first_name || ''
      }
    }

    // Find user by Clerk user ID
    let user = await User.findOne({ clerkUserId })

    // If not found by clerkUserId, try by email
    if (!user && email) {
      user = await User.findOne({ email })

      if (user) {
        // Migrate old email/password account to Clerk
        user.clerkUserId = clerkUserId
        user.provider = 'clerk'
        await user.save()

        // Migrate old characters and conversations
        const existingCharacters = await Character.countDocuments({ userId: String(user._id) })
        if (existingCharacters > 0) {
          await Character.updateMany(
            { userId: String(user._id), clerkUserId: { $exists: false } },
            { $rename: { userId: 'clerkUserId' } }
          )
          await Conversation.updateMany(
            { userId: String(user._id), clerkUserId: { $exists: false } },
            { $rename: { userId: 'clerkUserId' } }
          )
        }
      }
    }

    // If still not found, create a new user
    if (!user) {
      user = new User({
        email: email || `${clerkUserId}@clerk.local`,
        name,
        clerkUserId,
        provider: 'clerk',
        subscription: 'free'
      })
      await user.save()
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        subscription: user.subscription,
        clerkUserId: user.clerkUserId
      }
    })
  } catch (error: any) {
    console.error('Get user error:', error)
    res.status(500).json({ error: error.message || 'Failed to get user' })
  }
})

// Update subscription status (called after payment webhook)
router.put('/subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body
    const user = await User.findOneAndUpdate(
      { clerkUserId: req.clerkUserId },
      { subscription },
      { new: true }
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ subscription: user.subscription })
  } catch (error: any) {
    console.error('Subscription update error:', error)
    res.status(500).json({ error: error.message || 'Failed to update subscription' })
  }
})

export default router
