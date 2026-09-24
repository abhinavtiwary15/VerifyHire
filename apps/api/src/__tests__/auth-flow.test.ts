import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { maskEmail, maskPhone } from '../middleware/auth.js'

describe('Auth Utility Functions', () => {
  describe('maskEmail', () => {
    it('should mask all but first char of local part', () => {
      const masked = maskEmail('john.doe@example.com')
      assert.ok(masked.startsWith('j'), 'Should keep first char')
      assert.ok(masked.includes('***'), 'Should mask with ***')
      assert.ok(masked.includes('@example.com'), 'Should keep domain')
    })

    it('should preserve the domain', () => {
      const masked = maskEmail('test@company.io')
      assert.ok(masked.endsWith('@company.io'), `Expected domain preserved, got: ${masked}`)
    })
  })

  describe('maskPhone', () => {
    it('should mask all digits except last 4', () => {
      const masked = maskPhone('+1 (555) 123-4567')
      // Last 4 digits (4567) should be visible
      assert.ok(masked.endsWith('4567'), `Expected last 4 digits visible, got: ${masked}`)
    })
  })
})
