// apps/api/src/routes/interview-analyze.ts
import { FastifyInstance } from 'fastify'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth } from '../middleware/auth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

const ANALYSIS_PROMPT = `You are a video conferencing integrity monitor for a hiring platform. Analyze this video frame and respond ONLY with a JSON object.

Analyze the image for:
1. face_present: boolean - is there a human face visible?
2. face_count: number - how many faces are visible (0, 1, 2+)?
3. multiple_people: boolean - more than one person visible?
4. looking_away: boolean - person appears to be reading/looking off-screen significantly?
5. lighting_quality: "good" | "poor" | "none" - lighting conditions
6. frame_quality: "good" | "blurry" | "dark" | "empty"
7. flags: string[] - array of concern identifiers from: ["NO_FACE", "MULTIPLE_FACES", "LOOKING_AWAY", "POOR_LIGHTING", "CAMERA_COVERED"]
8. confidence: number 0-100 - confidence in the analysis
9. description: string - 1 sentence plain English summary of what was observed

Important: respond with ONLY the JSON object, no markdown, no code blocks, no extra text.`

interface FrameAnalysisResult {
  face_present: boolean
  face_count: number
  multiple_people: boolean
  looking_away: boolean
  lighting_quality: 'good' | 'poor' | 'none'
  frame_quality: 'good' | 'blurry' | 'dark' | 'empty'
  flags: string[]
  confidence: number
  description: string
}

export async function interviewAnalyzeRoutes(app: FastifyInstance) {
  // POST /api/v1/interview/analyze-frame
  app.post('/analyze-frame', { preHandler: requireAuth }, async (req, reply) => {
    const { frameData, sessionId } = req.body as { frameData: string; sessionId?: string }

    if (!frameData) {
      return reply.status(400).send({ success: false, error: 'frameData is required', requestId: req.id })
    }

    if (!process.env.GEMINI_API_KEY) {
      return reply.status(503).send({ success: false, error: 'Gemini API key not configured', requestId: req.id })
    }

    // Strip data URL prefix if present
    const base64Data = frameData.replace(/^data:image\/\w+;base64,/, '')

    try {
      const result = await model.generateContent([
        { text: ANALYSIS_PROMPT },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
      ])

      const responseText = result.response.text().trim()
      
      // Extract JSON if wrapped in markdown code block
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini')
      }

      const analysis: FrameAnalysisResult = JSON.parse(jsonMatch[0])

      return reply.send({
        success: true,
        data: {
          ...analysis,
          sessionId,
          analyzedAt: new Date().toISOString(),
          provider: 'gemini-1.5-flash',
          disclaimer: 'AI-assisted visual anomaly detection. Not a deepfake detection model. For informational purposes only.',
        },
        requestId: req.id,
      })
    } catch (err: any) {
      app.log.error({ err }, '[InterviewAnalyze] Gemini vision analysis failed')
      // Return a safe fallback rather than 500
      return reply.send({
        success: true,
        data: {
          face_present: null,
          face_count: null,
          multiple_people: false,
          looking_away: false,
          lighting_quality: 'good',
          frame_quality: 'good',
          flags: [],
          confidence: 0,
          description: 'Frame analysis temporarily unavailable',
          sessionId,
          analyzedAt: new Date().toISOString(),
          provider: 'fallback',
          error: 'Vision analysis failed: ' + err.message,
        },
        requestId: req.id,
      })
    }
  })
}
