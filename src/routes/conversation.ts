import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import Conversation from '../models/Conversation.js'
import Character from '../models/Character.js'
import User from '../models/User.js'
import { getAIResponse } from '../services/deepseek.js'
import { checkContent } from '../services/moderation.js'

const router = Router()

// Send message and get AI response
router.post('/message', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { characterId, message } = req.body
    
    if (!characterId) {
      return res.status(400).json({ error: 'Missing characterId' })
    }

    // Get character
    const character = await Character.findOne({ _id: characterId, userId })
    if (!character) {
      return res.status(404).json({ error: 'Character not found' })
    }

    // Check content for sensitive material
    const moderationResult = checkContent(message)
    if (moderationResult.flagged) {
      return res.status(400).json({
        error: 'Content policy violation',
        message: moderationResult.message || 'Your message contains inappropriate content.',
        category: moderationResult.category
      })
    }

    // Get or create conversation
    let conversation = await Conversation.findOne({ characterId, userId })

    // Check message limit for free users
    const user = await User.findById(userId)
    if (user?.subscription === 'free') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const todayMessages = conversation?.messages.filter(
        m => m.createdAt >= today
      ).length || 0

      if (todayMessages >= 10) {
        return res.status(403).json({ 
          error: 'daily_limit_reached',
          message: 'You have reached your daily message limit. Upgrade to Pro for unlimited messages.'
        })
      }
    }

    if (!conversation) {
      conversation = new Conversation({
        characterId,
        userId,
        messages: [],
        keywordMemory: []
      })
    }

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      createdAt: new Date()
    })

    // Get AI response
    const aiResponse = await getAIResponse(character, conversation.messages)

    // Add AI response
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse,
      createdAt: new Date()
    })

    // Update memory (extract keywords - simplified version)
    if (conversation.messages.length % 4 === 0) {
      const lastMessages = conversation.messages.slice(-4)
      const keywords = extractKeywords(lastMessages.map(m => m.content))
      conversation.keywordMemory = [...new Set([...conversation.keywordMemory, ...keywords])].slice(-50)
    }

    conversation.lastUpdated = new Date()
    await conversation.save()

    res.json({
      response: aiResponse,
      conversation: {
        id: conversation._id,
        messageCount: conversation.messages.length,
        memoryStatus: conversation.keywordMemory.length >= 30 ? 'good' : 'developing'
      }
    })
  } catch (error) {
    console.error('Message error:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// Get conversation history
router.get('/:characterId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await Conversation.findOne({ 
      characterId: req.params.characterId, 
      userId: req.userId 
    })

    res.json({ 
      conversation: conversation || { messages: [], keywordMemory: [] } 
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversation' })
  }
})

// Simple keyword extraction
function extractKeywords(texts: string[]): string[] {
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'their', 'them', 'his', 'her', 'my', 'your', 'our', 'me', 'him', 'us']
  
  const words = texts.join(' ').toLowerCase().split(/\s+/)
  return words
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .filter((word, index, arr) => arr.indexOf(word) === index)
}

export default router
