import OpenAI from "openai"

import { getNewProvider as getNewOpenAIProvider } from "#/platform/ai/adapters/openai"
import { buildIntroExtractionPrompt } from "#/platform/ai/prompts/intake/intro-extraction.prompt"
import { IntroExtractionSchema } from "#/platform/intake/intro/intro-extraction.schemas"
import type { IntroExtraction } from "#/platform/intake/intro/intro-extraction.types"
import { extractText } from "../utils/utils"

type ExtractIntroResult =
  | {
      ok: true
      data: IntroExtraction
      error: undefined
    }
  | {
      ok: false
      data: undefined
      error: unknown
    }

const makeExtractFromIntro =
  (client: OpenAI, model: AgentFactoryParams["model"]) =>
  async (message: string): Promise<ExtractIntroResult> => {
  try {
    const { system, user } = buildIntroExtractionPrompt(message)

    const response = await client.responses.create({
      model,
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

type AgentFactoryParams = {
  model: "gpt-4.1-mini"
}

/* interface iClient {
  responses: {
    create: (opts: {
      model: string
      input: unknown
    }) => Promise<{
      error?: unknown
      output_text?: string
    }>
  }
} */
interface iClientAPI {
  init: true
  agent: AgentFactoryParams
  client: OpenAI
  intake: {
    intro: {
      extractFromIntro: (message: string) => Promise<ExtractIntroResult>
    }
  }
}

export type ClientErrorAPI = {
  init: false
  agent: { model: undefined }
  client: null
}

export const unitializedClient: ClientErrorAPI = {
  init: false,
  agent: { model: undefined },
  client: null,
}

export const createProvider = ({ model }: AgentFactoryParams): iClientAPI | ClientErrorAPI => {
  switch (model) {
    case "gpt-4.1-mini":
      const client = getNewOpenAIProvider()

      return {
        init: true,
        agent: { model },
        client,
        intake: {
          intro: {
            extractFromIntro: makeExtractFromIntro(client, model),
          }
        }
      }

    default:
      console.log(`Model not found: ${model}`)
      return {
        ...unitializedClient
      }
  }
}