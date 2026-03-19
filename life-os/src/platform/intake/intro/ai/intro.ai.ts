import type { IntroExtraction } from "#/platform/intake/intro/intro-extraction.types"
import { createProvider, unitializedClient } from "#/platform/ai/adapters/agent.factory";

type ExtractIntroWithAIReturn =
  | { ok: true, data: IntroExtraction, error: undefined }
  | { ok: false, data: undefined, error: any };

let client: ReturnType<typeof createProvider> = unitializedClient

const getClient = () => {
  if (client.init) return client

  client = createProvider({
    model: "gpt-4.1-mini",
  })

  return client
}

export const extractIntroWithAI = async (message: string): Promise<ExtractIntroWithAIReturn> => {
  const client = getClient()

  if (!client.init) return {
    ok: false,
    data: undefined,
    error: new Error('Client could not be initialized')
  }

  const aiResponse = await client.intake.intro.extractFromIntro(message)

  if (!aiResponse.ok) return aiResponse

  return aiResponse
}