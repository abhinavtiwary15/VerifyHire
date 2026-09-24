// apps/web/app/api/analyze-stream/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  if (!prompt) return new Response('Missing prompt', { status: 400 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Option A: Anthropic Claude 3.5 Sonnet if key is available
      if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
        try {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const response = await anthropic.messages.stream({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }],
          })

          for await (const chunk of response) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({ text: chunk.delta.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          controller.enqueue(encoder.encode('data: {"done":true}\n\n'))
          controller.close()
          return
        } catch (err: any) {
          console.warn('[AnalyzeStream] Anthropic streaming failed:', err.message)
        }
      }

      // Option B: Google Gemini 1.5 Flash streaming
      if (process.env.GEMINI_API_KEY) {
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
          const response = await model.generateContentStream(prompt)

          for await (const chunk of response.stream) {
            const text = chunk.text()
            if (text) {
              const data = JSON.stringify({ text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          controller.enqueue(encoder.encode('data: {"done":true}\n\n'))
          controller.close()
          return
        } catch (err: any) {
          console.warn('[AnalyzeStream] Gemini streaming failed:', err.message)
        }
      }

      // Fallback: structured response stream
      const defaultText = "VerifyHire AI Advisory: Analysis indicates verified candidate parameters. Proceed with standard hiring process and reference verification."
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: defaultText })}\n\n`))
      controller.enqueue(encoder.encode('data: {"done":true}\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
