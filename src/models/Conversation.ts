import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface IConversation extends Document {
  characterId: string
  userId: string
  messages: IMessage[]
  keywordMemory: string[]
  lastUpdated: Date
  createdAt: Date
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

const ConversationSchema = new Schema<IConversation>({
  characterId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  messages: [MessageSchema],
  keywordMemory: [{ type: String }],
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
})

// Convert _id to id in JSON response
ConversationSchema.set('toJSON', {
  virtuals: true,
  transform(_doc: unknown, ret: IConversation & { _id: unknown; __v: number }) {
    ret.id = String(ret._id)
    delete (ret as Partial<IConversation & { _id: unknown; __v: number }>)._id
    delete (ret as Partial<IConversation & { _id: unknown; __v: number }>).__v
    return ret
  }
})

export default mongoose.model<IConversation>('Conversation', ConversationSchema)
