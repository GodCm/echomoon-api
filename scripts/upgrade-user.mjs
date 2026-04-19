import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGODB_URI

console.log('Connecting to MongoDB...')
console.log('URI starts with:', MONGODB_URI?.slice(0, 30))

await mongoose.connect(MONGODB_URI)
console.log('Connected!')

const User = mongoose.model('User', new mongoose.Schema({
  email: String,
  subscription: String
}))

const email = '1870374843@qq.com'
const result = await User.findOneAndUpdate(
  { email },
  { subscription: 'pro' },
  { new: true }
)

if (result) {
  console.log(`✅ Upgraded ${email} to Pro!`)
  console.log('User:', result)
} else {
  console.log(`❌ User not found: ${email}`)
  
  // List all users
  const allUsers = await User.find({}, { email: 1, subscription: 1 })
  console.log('All users:', allUsers)
}

await mongoose.disconnect()
process.exit(0)
