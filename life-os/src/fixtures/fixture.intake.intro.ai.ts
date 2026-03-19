export const mockIntroResponse = {
  id: 'resp_03f74d271dbb273f0069bada51f5dc81a29090f0691d467508',
  object: 'response',
  created_at: 1773853265,
  status: 'completed',
  background: false,
  billing: { payer: 'developer' },
  completed_at: 1773853269,
  error: null,
  frequency_penalty: 0,
  incomplete_details: null,
  instructions: null,
  max_output_tokens: null,
  max_tool_calls: null,
  model: 'gpt-4.1-mini-2025-04-14',
  output: [
    {
      id: 'msg_0a34bb4599158dba0069badd5110c0819e8f649bc3095ec8da',
      type: 'message',
      status: 'completed',
      content: [Array],
      role: 'assistant'
    }
  ],
  parallel_tool_calls: true,
  presence_penalty: 0,
  previous_response_id: null,
  prompt_cache_key: null,
  prompt_cache_retention: null,
  reasoning: { effort: null, summary: null },
  safety_identifier: null,
  service_tier: 'default',
  store: true,
  temperature: 1,
  text: { format: [Object], verbosity: 'medium' },
  tool_choice: 'auto',
  tools: [],
  top_logprobs: 0,
  top_p: 1,
  truncation: 'disabled',
  usage: {
    input_tokens: 188,
    input_tokens_details: [Object],
    output_tokens: 174,
    output_tokens_details: [Object],
    total_tokens: 362
  },
  user: null,
  metadata: {},
  output_text: '```json\n' +
    '{\n' +
    '  "summary": "User wants to improve their morning routine with accountability, considering they work on weekdays.",\n' +
    '  "goals": ["Improve morning routine"],\n' +
    '  "constraints": ["Work on weekdays"],\n' +
    '  "preferences": ["Prefer direct accountability"],\n' +
    '  "missingInfo": ["Specific aspects of mornings to improve", "Current morning routine", "Preferred types of accountability", "Wake-up time", "Available morning time"],\n' +
    '  "suggestedNextQuestions": [\n' +
    '    "What specific aspects of your morning routine do you want to improve?",\n' +
    '    "What time do you usually wake up on weekdays?",\n' +
    '    "What kind of direct accountability do you prefer?",\n' +
    '    "How much time do you have available in the mornings?",\n' +
    '    "Do you have any morning activities you want to include or exclude?"\n' +
    '  ],\n' +
    '  "status": "CONTINUE"\n' +
    '}\n' +
    '```'
}

export const mockPayloadV1 = {
  "payload": {
    "message": "I feel like my days are kind of unstructured and I want to get better about that.",
    "extraction": {
      "summary": "The user feels their days are unstructured and wants to improve their daily structure.",
      "goals": [
        "Improve daily structure"
      ],
      "constraints": [],
      "preferences": [],
      "missingInfo": [
        "Current daily routine details",
        "Specific areas to improve",
        "Preferred time allocation or framework"
      ],
      "suggestedNextQuestions": [
        "Can you describe your current daily routine?",
        "Are there specific parts of your day you'd like to structure better?",
        "Do you prefer a particular planning method (e.g., time blocks, to-do lists)?"
      ],
      "status": "CONTINUE"
    }
  }
}

export const mockPayloadV2 = {
  "payload": {
    "message": "I want to improve my mornings but I work weekdays and prefer direct accountability",
    "extraction": {
      "summary": "User wants to improve their morning routine with accountability, considering they work on weekdays.",
      "goals": [
        "Improve morning routine"
      ],
      "constraints": [
        "Work on weekdays"
      ],
      "preferences": [
        "Prefer direct accountability"
      ],
      "missingInfo": [
        "Specific aspects of mornings to improve",
        "Current morning routine",
        "Preferred types of accountability",
        "Wake-up time",
        "Available morning time"
      ],
      "suggestedNextQuestions": [
        "What specific aspects of your morning routine do you want to improve?",
        "What time do you usually wake up on weekdays?",
        "What kind of direct accountability do you prefer?",
        "How much time do you have available in the mornings?",
        "Do you have any morning activities you want to include or exclude?"
      ],
      "status": "CONTINUE"
    }
  }
}