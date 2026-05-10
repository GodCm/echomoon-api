import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import dotenv from 'dotenv'
import User from '../models/User.js'
import axios from 'axios'

dotenv.config()

const router = Router()

// Creem webhook secret from dashboard
const WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET || ''
const CREEM_API_KEY = process.env.CREEM_API_KEY || ''
const CREEM_PRODUCT_ID = process.env.CREEM_PRODUCT_ID || ''
const SUCCESS_URL = process.env.CREEM_SUCCESS_URL || 'https://echomoon-web.vercel.app/dashboard'
const CANCEL_URL = process.env.CREEM_CANCEL_URL || 'https://echomoon-web.vercel.app/subscribe'

// Creem API base URL (typically these would be the endpoints)
const CREEM_API_BASE_URL = 'https://api.creem.io' // Adjust based on actual Creem API URL

/**
 * Create Creem checkout session
 * This endpoint generates a checkout URL for the user to complete payment
 */
router.post('/create-checkout', async (req: Request, res: Response) => {
  try {
    const { clerkUserId, productId } = req.body
    
    if (!clerkUserId) {
      return res.status(400).json({ error: 'clerkUserId is required' })
    }
    
    const finalProductId = productId || CREEM_PRODUCT_ID
    
    if (!finalProductId) {
      return res.status(400).json({ error: 'Product ID is required' })
    }
    
    if (!CREEM_API_KEY) {
      return res.status(500).json({ error: 'Creem API key not configured' })
    }
    
    // Call Creem API to create checkout session
    // Note: Adjust the endpoint and payload based on actual Creem API docs
    const checkoutPayload: any = {
      product_id: finalProductId,
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL
    }
    
    // Add metadata only if clerkUserId is provided
    if (clerkUserId) {
      checkoutPayload.metadata = {
        clerkUserId: String(clerkUserId)
      }
    }
    
    const response = await axios.post(
      `${CREEM_API_BASE_URL}/v1/checkout`,
      checkoutPayload,
      {
        headers: {
          'Authorization': `Bearer ${CREEM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    // Return the checkout URL to the frontend
    res.json({
      checkout_url: response.data.checkout_url || response.data.url
    })
    
  } catch (error: any) {
    console.error('Error creating Creem checkout session:', error.response?.data || error.message)
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.response?.data || error.message
    })
  }
})

/**
 * Verify Creem webhook signature
 * Uses HMAC-SHA256 with the raw request body
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('CREEM_WEBHOOK_SECRET not set, skipping verification')
    return true // Allow in development
  }

  const computedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  )
}

/**
 * Parse raw body for signature verification
 * With bodyParser.raw() middleware on the webhook route,
 * req.body will be a Buffer when Content-Type is application/json
 */
router.post('/webhook', (req: Request, res: Response) => {
  // Get raw body from request (Buffer) for signature verification
  const rawBody = req.body instanceof Buffer 
    ? req.body.toString('utf8') 
    : JSON.stringify(req.body)
  
  const signature = req.headers['creem-signature'] as string

  // Verify signature
  if (signature && !verifySignature(rawBody, signature)) {
    console.error('Invalid Creem webhook signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Parse the event
  let event
  try {
    event = JSON.parse(rawBody)
  } catch (err) {
    console.error('Invalid JSON in webhook body')
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const { eventType, object } = event

  console.log(`Received Creem event: ${eventType}`, object)

  // Handle different event types
  switch (eventType) {
    case 'checkout.completed':
      handleCheckoutCompleted(object)
      break
    
    case 'subscription.paid':
      handleSubscriptionPaid(object)
      break
    
    case 'subscription.active':
      handleSubscriptionActive(object)
      break
    
    case 'subscription.canceled':
      handleSubscriptionCanceled(object)
      break
    
    case 'subscription.scheduled_cancel':
      handleSubscriptionScheduledCancel(object)
      break
    
    case 'subscription.past_due':
      handleSubscriptionPastDue(object)
      break
    
    case 'refund.created':
      handleRefundCreated(object)
      break
    
    default:
      console.log(`Unhandled event type: ${eventType}`)
  }

  // Always return 200 quickly to acknowledge receipt
  res.status(200).json({ received: true })
})

/**
 * Handle checkout completed event
 * This is triggered when a customer completes the checkout process
 */
async function handleCheckoutCompleted(object: any) {
  try {
    const { customer, metadata } = object
    
    // Get user ID from metadata (we'll pass this when creating checkout)
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) {
      console.error('No clerkUserId in checkout metadata')
      return
    }
    
    // Update user subscription to pro
    const user = await User.findOne({ clerkUserId })
    
    if (user) {
      user.subscription = 'pro'
      await user.save()
      console.log(`User ${clerkUserId} upgraded to pro via checkout`)
    } else {
      console.error(`User not found for clerkUserId: ${clerkUserId}`)
    }
  } catch (error) {
    console.error('Error handling checkout.completed:', error)
  }
}

/**
 * Handle subscription paid event
 * This is the best event to grant access (per Creem docs)
 */
async function handleSubscriptionPaid(object: any) {
  try {
    const { customer, metadata, current_period_end_date } = object
    
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) {
      console.error('No clerkUserId in subscription metadata')
      return
    }
    
    const user = await User.findOne({ clerkUserId })
    
    if (user) {
      user.subscription = 'pro'
      // Could also store subscription end date if needed
      await user.save()
      console.log(`User ${clerkUserId} subscription paid, access granted`)
    } else {
      console.error(`User not found for clerkUserId: ${clerkUserId}`)
    }
  } catch (error) {
    console.error('Error handling subscription.paid:', error)
  }
}

/**
 * Handle subscription active event
 * Use this for synchronization (per Creem docs)
 */
async function handleSubscriptionActive(object: any) {
  try {
    const { customer, metadata } = object
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) return
    
    const user = await User.findOne({ clerkUserId })
    if (user) {
      user.subscription = 'pro'
      await user.save()
      console.log(`User ${clerkUserId} subscription active`)
    }
  } catch (error) {
    console.error('Error handling subscription.active:', error)
  }
}

/**
 * Handle subscription canceled event
 */
async function handleSubscriptionCanceled(object: any) {
  try {
    const { customer, metadata } = object
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) return
    
    const user = await User.findOne({ clerkUserId })
    if (user) {
      user.subscription = 'free'
      await user.save()
      console.log(`User ${clerkUserId} subscription canceled, downgraded to free`)
    }
  } catch (error) {
    console.error('Error handling subscription.canceled:', error)
  }
}

/**
 * Handle subscription scheduled to cancel
 * User will lose access at period end
 */
async function handleSubscriptionScheduledCancel(object: any) {
  try {
    const { customer, metadata } = object
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) return
    
    // Could notify user that subscription will cancel at period end
    console.log(`User ${clerkUserId} subscription scheduled to cancel`)
  } catch (error) {
    console.error('Error handling subscription.scheduled_cancel:', error)
  }
}

/**
 * Handle subscription past due
 * Payment failed, but will retry
 */
async function handleSubscriptionPastDue(object: any) {
  try {
    const { customer, metadata } = object
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) return
    
    // Could notify user to update payment method
    console.log(`User ${clerkUserId} subscription past due`)
  } catch (error) {
    console.error('Error handling subscription.past_due:', error)
  }
}

/**
 * Handle refund created
 */
async function handleRefundCreated(object: any) {
  try {
    const { customer, metadata } = object
    const clerkUserId = metadata?.clerkUserId
    
    if (!clerkUserId) return
    
    // Refund issued, downgrade user
    const user = await User.findOne({ clerkUserId })
    if (user) {
      user.subscription = 'free'
      await user.save()
      console.log(`User ${clerkUserId} refunded, downgraded to free`)
    }
  } catch (error) {
    console.error('Error handling refund.created:', error)
  }
}

export default router
