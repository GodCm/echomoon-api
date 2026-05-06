import { Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/clerk-sdk-node'

export interface AuthRequest extends Request {
  clerkUserId?: string
  userId?: string  // kept for backwards compatibility
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = await clerkClient.verifyToken(token)
    // Clerk JWT payload contains: sub (userId), email, etc.
    req.clerkUserId = decoded.sub
    req.userId = decoded.sub  // backwards compatibility
    next()
  } catch (error: any) {
    console.error('Clerk token verification failed:', error?.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
}
