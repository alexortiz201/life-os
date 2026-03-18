import "dotenv/config"
import OpenAI from "openai"

import { buildIntroExtractionPrompt } from "#/platform/ai/prompts/intake/intro-extraction.prompt"

import { IntroExtractionSchema, type IntroExtraction } from "../intro-extraction.schemas"

export const extractText = (response: any) => {
  if (!response?.output_text) {
    throw new Error("Missing response.output_text")
  }

  return response.output_text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

const createProvider = (client: OpenAI) => ({
  async call({ message }: {
    message: string
  }) {
    const { system, user } = buildIntroExtractionPrompt(message)
    try {
      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: user }],
          },
        ],
      })

      if (response.error) throw Error('Issue talking to Walle...')

      const text = extractText(response)
      const parsed = JSON.parse(text)

      return {
        ok: true as const,
        data: IntroExtractionSchema.parse(parsed),
        error: undefined,
      }
    } catch (error) {
      console.log("Error getting Walle's input: ", { error })
      return {
        ok: false as const,
        error,
        data: undefined,
      }
    }
  }
})

type ExtractIntroWithAIReturn =
  | { ok: true, data: IntroExtraction, error: undefined }
  | { ok: false, data: undefined, error: any };

export const extractIntroWithAI = async (message: string): Promise<ExtractIntroWithAIReturn> => {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const provider = createProvider(client)
  const aiResponse = await provider.call({ message })

  if (!aiResponse.ok) return aiResponse

  return aiResponse
}