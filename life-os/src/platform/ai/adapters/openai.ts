import "dotenv/config"
import OpenAI from "openai"

export const getNewProvider = (opts = {}) => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...opts,
  });
}