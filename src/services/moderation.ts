// Content moderation service - local keyword-based filtering
// This is a basic filter; for production, consider using OpenAI Moderation API or similar services

interface ModerationResult {
  flagged: boolean
  category?: string
  message?: string
}

// Categories of sensitive content
const sensitivePatterns = {
  violence: [
    /\b(kill|murder|death|die|dead|suicide|attack|hurt|harm|beat|hit|slash|stab|shoot|gun|knife|weapon|explosive|bomb|terrorist)\b/gi,
  ],
  sexual: [
    /\b(sex|naked|nude|porn|erotic|xxx|sexual|fuck|shit|damn|ass|slut|whore|bitch|dick|pussy|cunt)\b/gi,
  ],
  political: [
    // This is intentionally left minimal - focus on general harmful content
    // Add specific patterns only if needed for your use case
  ],
  illegal: [
    /\b(drug|cocaine|heroin|marijuana|cannabis|meth|lsd|ecstasy|hack|steal|rob|fraud|scam)\b/gi,
  ],
  selfHarm: [
    /\b(suicide|kill myself|end my life|want to die|self harm|cut myself)\b/gi,
  ]
}

// Warning messages for each category
const warningMessages: Record<string, string> = {
  violence: "Please keep the conversation peaceful. Violent content is not appropriate here.",
  sexual: "Let's keep our conversation appropriate and respectful.",
  political: "This conversation should remain neutral. Political content is not appropriate.",
  illegal: "Please avoid discussing illegal activities.",
  selfHarm: "If you're having thoughts of self-harm, please reach out to a mental health professional for support. You're not alone."
}

export function checkContent(text: string): ModerationResult {
  const lowerText = text.toLowerCase()
  
  // Check each category
  for (const [category, patterns] of Object.entries(sensitivePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        return {
          flagged: true,
          category,
          message: warningMessages[category]
        }
      }
      // Reset lastIndex for global regex
      pattern.lastIndex = 0
    }
  }
  
  return { flagged: false }
}

export function filterSensitiveWords(text: string): string {
  // Replace sensitive words with asterisks
  let filtered = text
  
  for (const [, patterns] of Object.entries(sensitivePatterns)) {
    for (const pattern of patterns) {
      filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length))
      pattern.lastIndex = 0
    }
  }
  
  return filtered
}
