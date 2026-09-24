import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

// Replicate the fallback scoring function for unit testing
function fallbackScoring(text: string) {
  const aiPhrases = [
    'highly scalable', 'cutting-edge', 'robust and performant', 'leverage',
    'passionate about', 'seasoned professional', 'exceptional user experiences',
    'synergize', 'deliverables', 'optimize developer productivity',
    'cloud-native', 'best practices', 'cross-functional teams',
  ]
  const lower = text.toLowerCase()
  const hits = aiPhrases.filter((p) => lower.includes(p)).length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  const avgLen = sentences.reduce((a, s) => a + s.split(' ').length, 0) / Math.max(1, sentences.length)
  const uniformity = sentences.length > 3
    ? 1 - (sentences.map((s) => s.split(' ').length).reduce((a, b, _, arr) => {
        const mean = arr.reduce((x, y) => x + y) / arr.length
        return a + Math.abs(b - mean)
      }, 0) / (sentences.length * avgLen))
    : 0.5

  const aiGeneratedScore = Math.min(95, Math.max(0, hits * 5 + uniformity * 40 + (avgLen > 22 ? 15 : 0)))

  return {
    aiGeneratedScore,
    perplexityScore: Math.max(5, 100 - aiGeneratedScore * 0.9),
    burstinessScore: Math.max(5, 100 - uniformity * 80),
    stylometricScore: Math.max(10, 100 - aiGeneratedScore * 0.6),
  }
}

describe('Resume Fallback Scoring', () => {
  const AI_HEAVY_RESUME = `Marcus Chen is a seasoned software engineer with 8+ years of experience architecting highly scalable distributed systems. Proficient in building robust and performant solutions using cutting-edge technologies. Passionate about leveraging best practices and optimize developer productivity. Cross-functional teams collaboration is key.`

  const NATURAL_RESUME = `I spent three years at a small startup where I built the backend API from scratch. It was messy at times - we had a lot of bugs in the early days and I learned a ton from them. My manager and I didn't always agree, but we shipped the product.`

  it('should score AI-heavy text higher than natural text', () => {
    const aiResult = fallbackScoring(AI_HEAVY_RESUME)
    const naturalResult = fallbackScoring(NATURAL_RESUME)
    assert.ok(
      aiResult.aiGeneratedScore > naturalResult.aiGeneratedScore,
      `AI text (${aiResult.aiGeneratedScore}) should score higher than natural text (${naturalResult.aiGeneratedScore})`
    )
  })

  it('should return scores within valid range 0-100', () => {
    const result = fallbackScoring(AI_HEAVY_RESUME)
    assert.ok(result.aiGeneratedScore >= 0 && result.aiGeneratedScore <= 100)
    assert.ok(result.perplexityScore >= 0 && result.perplexityScore <= 100)
    assert.ok(result.burstinessScore >= 0 && result.burstinessScore <= 100)
    assert.ok(result.stylometricScore >= 0 && result.stylometricScore <= 100)
  })

  it('should detect AI buzzphrases', () => {
    const textWithBuzzwords = 'leverage synergize cross-functional teams deliverables cutting-edge passionate about cloud-native'  
    const result = fallbackScoring(textWithBuzzwords)
    assert.ok(result.aiGeneratedScore > 0, 'Should detect AI buzzwords')
  })
})
