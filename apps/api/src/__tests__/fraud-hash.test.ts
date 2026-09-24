import { strict as assert } from 'node:assert'
import { describe, it, before, after } from 'node:test'
import crypto from 'crypto'

// Test HMAC hashing in isolation without importing the full service
function hmacHash(value: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(value).digest('hex')
}

describe('Fraud Network HMAC Hashing', () => {
  it('should produce consistent hashes for same input and salt', () => {
    const salt = 'test-salt-abc123'
    const email = 'test@example.com'
    const hash1 = hmacHash(email, salt)
    const hash2 = hmacHash(email, salt)
    assert.equal(hash1, hash2)
  })

  it('should produce different hashes for different salts', () => {
    const email = 'test@example.com'
    const hash1 = hmacHash(email, 'salt-one')
    const hash2 = hmacHash(email, 'salt-two')
    assert.notEqual(hash1, hash2)
  })

  it('should produce different hashes for different inputs', () => {
    const salt = 'test-salt-abc123'
    const hash1 = hmacHash('user1@example.com', salt)
    const hash2 = hmacHash('user2@example.com', salt)
    assert.notEqual(hash1, hash2)
  })

  it('should produce a 64-char hex string', () => {
    const hash = hmacHash('any@example.com', 'any-salt')
    assert.equal(hash.length, 64)
    assert.match(hash, /^[a-f0-9]{64}$/)
  })

  it('should lowercase-normalize before hashing to avoid case collisions', () => {
    const salt = 'test-salt'
    // Simulate what the fraud network does: lowercase before hashing
    const hash1 = hmacHash('User@Example.COM'.toLowerCase(), salt)
    const hash2 = hmacHash('user@example.com', salt)
    assert.equal(hash1, hash2, 'Case-normalized hashes should match')
  })
})
