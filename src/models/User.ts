import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  email: string
  password?: string
  name?: string
  avatar?: string
  provider: 'google' | 'apple' | 'email'
  subscription: 'free' | 'pro'
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String },
  avatar: { type: String },
  provider: { type: String, enum: ['google', 'apple', 'email'], default: 'email' },
  subscription: { type: String, enum: ['free', 'pro'], default: 'free' },
  createdAt: { type: Date, default: Date.now }
})

// Convert _id to id in JSON response
UserSchema.set('toJSON', {
  virtuals: true,
  transform(_doc: unknown, ret: IUser & { _id: unknown; __v: number }) {
    ret.id = String(ret._id)
    delete (ret as Partial<IUser & { _id: unknown; __v: number }>)._id
    delete (ret as Partial<IUser & { _id: unknown; __v: number }>).__v
    return ret
  }
})

export default mongoose.model<IUser>('User', UserSchema)
