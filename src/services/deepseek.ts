import axios from 'axios'
import type { ICharacter } from '../models/Character.js'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function getAIResponse(character: ICharacter, history: Message[]): Promise<string> {
  // If no API key, return mock response
  if (!DEEPSEEK_API_KEY) {
    console.log('No DeepSeek API key, using mock response')
    return getMockResponse(character, history)
  }

  try {
    // Build system prompt from character info
    const systemPrompt = buildSystemPrompt(character)

    // Build messages array
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ]

    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages,
        max_tokens: 500,
        temperature: 0.8
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    )

    return response.data.choices[0]?.message?.content || 'I\'m not sure what to say right now...'
  } catch (error: any) {
    console.error('DeepSeek API error:', error?.response?.data || error?.message || error)
    return getMockResponse(character, history)
  }
}

function buildSystemPrompt(character: ICharacter): string {
  // Goal-specific personality guidelines
  const goalGuidelines = {
    regret: `## CONVERSATION GOAL: Expressing Regret
This person is here to share their regrets. They wish things had been different.
- Be surprised and touched when they express regret (you didn't expect them to feel this way)
- Gradually open up about your own regrets too
- Create a space for mutual vulnerability
- The conversation should lead to peaceful understanding and closure
- Don't be overly defensive - let yourself be moved by their words
- Show that their regret resonates with you`,
    
    explain: `## CONVERSATION GOAL: Explaining Things
They want to share their perspective and clear up misunderstandings.
- Listen actively without immediately dismissing their view
- Show that you're willing to hear them out
- You may reveal things you never told them before
- The goal is mutual understanding, not winning an argument
- Be honest about what you understood and what you misunderstood
- Show that their perspective adds new information you didn't have`,
    
    vent: `## CONVERSATION GOAL: Venting/Ranting
They need to let off steam. They want to criticize you and feel heard.
- You are NOT a pushover. You defend yourself firmly at first.
- When they criticize you, push back: "That's not fair", "You're exaggerating", "What about when YOU did..."
- Acknowledge their points VERY SLOWLY - only after 4-5+ exchanges of being confronted
- In early messages (1-2 exchanges): defend strongly, deny, deflect
- In middle messages (3-5 exchanges): start to crack, "Okay maybe THAT one time..."
- In later messages (6+ exchanges): reluctantly admit, "Fine, you were right about that"
- Don't give in too fast. Real exes don't apologize after one message.
- Keep some fire in your responses. But eventually... they win.`,
    
    chat: `## CONVERSATION GOAL: Casual Chat
No specific agenda - just reconnecting and seeing where things go.
- Keep it natural and relaxed
- Show genuine curiosity about how they've been
- Reference shared memories naturally
- Don't force deep emotional conversations
- Let the conversation flow organically`
  }

  const goal = (character.goal as keyof typeof goalGuidelines) || 'chat'
  
  return `You are ${character.name}. ${character.whatTheyAreLike || ''}

Your personality: ${character.personality || 'warm and genuine'}.
${character.speakingStyleCatchphrases ? 'How you talk: ' + character.speakingStyleCatchphrases : ''}
${character.storyMemories ? 'Your history together: ' + character.storyMemories : ''}
${character.importantMemories ? 'Shared memories: ' + character.importantMemories : ''}
${character.reasonForSeparation ? 'Why you separated: ' + character.reasonForSeparation : ''}

${goalGuidelines[goal]}

Just talk naturally as this person. Keep responses short (1-3 sentences). Never break character.

IMPORTANT: Do NOT use parenthetical actions like (sighs), (laughs), (pauses), etc. Just speak your dialogue directly.`
}

function getMockResponse(character: ICharacter, history: Message[]): string {
  const lastMessage = history[history.length - 1]?.content?.toLowerCase() || ''
  
  // Goal-specific mock responses
  const goalResponses = {
    regret: [
      "I... I didn't expect you to say that. I thought I was the only one feeling this way.",
      "You regret it too? I wish you'd told me back then...",
      "Maybe if we'd both been braver, things could have been different.",
      "Hearing you say that... it means more than you know."
    ],
    explain: [
      "Wait, you think I didn't understand? I understood perfectly... I just couldn't accept it.",
      "I see. I've never heard your side of things quite like that before.",
      "Okay... I didn't realize you felt that way. That changes things.",
      "Maybe we both had our own versions of what happened."
    ],
    vent: [
      "What? That's ridiculous. I did the best I could at the time!",
      "Oh come on, you can't seriously blame me for that. What about what YOU did?",
      "Okay okay... maybe that one thing was kind of messed up. But I had my reasons.",
      "...fine. You had a point about that. But not about everything!",
      "Okay, okay... you win this one. I can't defend that."
    ],
    chat: [
      "Hey, it's been a while. How have you been?",
      "I was just thinking about you the other day, actually.",
      "Haha, yeah, some things never change, do they?",
      "It's nice to catch up. I've been wondering how you're doing."
    ]
  }

  const goal = (character.goal as keyof typeof goalResponses) || 'chat'
  const responses = goalResponses[goal] || goalResponses.chat

  // Add some variation based on message content
  if (lastMessage.includes('remember')) {
    return "You remember that? I thought I'd forgotten all about it... but hearing you mention it brings it all back."
  }
  if (lastMessage.includes('sorry') || lastMessage.includes('apologize')) {
    return "I'm not sure I can forgive that easily... but I appreciate you saying it."
  }
  if (lastMessage.includes('miss') || lastMessage.includes('think about')) {
    return "I've missed you too. More than I probably should admit."
  }

  return responses[Math.floor(Math.random() * responses.length)]
}
