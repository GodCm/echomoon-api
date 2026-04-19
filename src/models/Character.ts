import mongoose, { Schema, Document } from 'mongoose'

export interface ICharacter extends Document {
  userId: string
  name: string
  avatar: string
  gender?: 'male' | 'female' | 'other'
  goal: 'regret' | 'explain' | 'vent' | 'chat'
  personality?: string
  storyMemories?: string
  reasonForSeparation?: string
  speakingStyleCatchphrases?: string
  importantMemories?: string
  forbiddenTopics?: string
  dateMet?: string
  anniversary?: string
  breakupDate?: string
  theirBirthday?: string
  myBirthday?: string
  whatTheyAreLike?: string
  createdAt: Date
  updatedAt: Date
}

const CharacterSchema = new Schema<ICharacter>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '🌙' },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  goal: { type: String, enum: ['regret', 'explain', 'vent', 'chat'], default: 'chat' },
  personality: { type: String, default: '' },
  storyMemories: { type: String, default: '' },
  reasonForSeparation: { type: String, default: '' },
  speakingStyleCatchphrases: { type: String, default: '' },
  importantMemories: { type: String, default: '' },
  forbiddenTopics: { type: String, default: '' },
  dateMet: { type: String },
  anniversary: { type: String },
  breakupDate: { type: String },
  theirBirthday: { type: String },
  myBirthday: { type: String },
  whatTheyAreLike: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Convert _id to id in JSON response
CharacterSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  }
})

export default mongoose.model<ICharacter>('Character', CharacterSchema)
