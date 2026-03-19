type Response = {
  output_text?: string
}

export const extractText = (response: Response | null | undefined) => {
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