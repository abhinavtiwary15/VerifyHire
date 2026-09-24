import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('Testing connection...')
    const count = await prisma.user.count()
    console.log('Success! User count:', count)
  } catch (err) {
    console.error('Connection failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
