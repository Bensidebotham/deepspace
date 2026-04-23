import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

export async function generateFileSummary(
  filePath: string,
  content: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })

  const preview = content.slice(0, 3000)
  const prompt = `You are a senior engineer helping a new hire understand a codebase. Answer in 2-3 sentences: what does this file do, what is its role in the project, and when would a developer need to touch it? Be concrete and specific.

File: ${filePath}

\`\`\`
${preview}
\`\`\``

  const result = await model.generateContent(prompt)
  return result.response.text() ?? 'No summary available.'
}
