import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateFileSummary(
  filePath: string,
  content: string
): Promise<string> {
  const preview = content.slice(0, 3000)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a senior engineer helping a new hire understand a codebase. Answer in 2-3 sentences: what does this file do, what is its role in the project, and when would a developer need to touch it? Be concrete and specific.',
      },
      {
        role: 'user',
        content: `File: ${filePath}\n\n\`\`\`\n${preview}\n\`\`\``,
      },
    ],
    max_tokens: 150,
  })
  return response.choices[0].message.content ?? 'No summary available.'
}
