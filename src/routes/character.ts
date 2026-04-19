import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import Character from '../models/Character.js'
import User from '../models/User.js'
import axios from 'axios'

const router = Router()

// Analyze chat history to extract character traits
router.post('/analyze-chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { chatText } = req.body
    
    if (!chatText || chatText.trim().length < 50) {
      return res.status(400).json({ error: 'Chat text is too short. Please provide more messages.' })
    }

    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
    
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: 'AI service not configured' })
    }

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are analyzing a chat conversation between two people (likely in a romantic relationship that ended). 
Based on their messages, extract information about the OTHER person's personality and communication style.

Extract and return a JSON with these fields:
- personality: 2-3 sentences describing their personality traits based on how they communicate
- speakingStyle: How they typically speak (short msgs, long msgs, uses emoji, formal, casual, etc.)
- importantMemories: Any shared experiences or meaningful moments mentioned in the chat (1-2 sentences)
- goal: Guess what the user might want from this conversation: 'regret' (expressing sadness/loss), 'explain' (wants to be understood), 'vent' (frustrated/angry), or 'chat' (casual/unclear)

Return ONLY valid JSON, no other text. Example format:
{"personality": "They seem caring but guarded...", "speakingStyle": "Short messages, uses lots of emojis...", "importantMemories": "Mentions a trip to Paris...", "goal": "vent"}`
          },
          {
            role: 'user',
            content: `Analyze this chat conversation:\n\n${chatText.slice(0, 4000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    )

    const content = response.data.choices[0]?.message?.content || '{}'
    
    // Parse JSON from response
    let analysis
    try {
      analysis = JSON.parse(content)
    } catch {
      // If parsing fails, try to extract JSON from the text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        return res.status(500).json({ error: 'Failed to analyze chat' })
      }
    }

    // Validate and sanitize the response
    const result = {
      personality: analysis.personality || '',
      speakingStyle: analysis.speakingStyle || '',
      importantMemories: analysis.importantMemories || '',
      goal: ['regret', 'explain', 'vent', 'chat'].includes(analysis.goal) ? analysis.goal : 'chat'
    }

    res.json(result)
  } catch (error: any) {
    console.error('Analyze chat error:', error?.response?.data || error.message)
    res.status(500).json({ error: 'Failed to analyze chat' })
  }
})

// Create character
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const user = await User.findById(userId)
    
    // Check character limit for free users
    if (user?.subscription === 'free') {
      const characterCount = await Character.countDocuments({ userId })
      if (characterCount >= 1) {
        return res.status(403).json({ error: 'Free users can only create 1 character. Upgrade to Pro for unlimited.' })
      }
    }

    const character = new Character({
      userId,
      ...req.body
    })

    await character.save()
    res.status(201).json({ character })
  } catch (error) {
    console.error('Create character error:', error)
    res.status(500).json({ error: 'Failed to create character' })
  }
})

// Get all characters for user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const characters = await Character.find({ userId: req.userId }).sort({ createdAt: -1 })
    res.json({ characters })
  } catch (error) {
    console.error('Get characters error:', error)
    res.status(500).json({ error: 'Failed to get characters' })
  }
})

// Get single character
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const character = await Character.findOne({ _id: req.params.id, userId: req.userId })
    if (!character) {
      return res.status(404).json({ error: 'Character not found' })
    }
    res.json({ character })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get character' })
  }
})

// Update character
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const character = await Character.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    )
    if (!character) {
      return res.status(404).json({ error: 'Character not found' })
    }
    res.json({ character })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update character' })
  }
})

// Delete character
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const character = await Character.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!character) {
      return res.status(404).json({ error: 'Character not found' })
    }
    res.json({ message: 'Character deleted' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete character' })
  }
})

export default router
