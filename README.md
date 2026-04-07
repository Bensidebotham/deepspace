# Deepspace

Turn any GitHub repository into an interactive 3D galaxy. Files are stars, imports are edges, related modules cluster together like constellations.

## Features
- Paste any public GitHub URL — no login required
- Sign in with GitHub to explore private repos
- Interactive 3D force-directed graph (zoom, pan, rotate)
- Click any file to see its AI-generated summary, connections, and code preview
- Search files by name and filter by module cluster

## Stack
Next.js · TypeScript · react-force-graph-3d · NextAuth.js · Trigger.dev · PostgreSQL (Neon) · OpenAI

## Local Development

1. Clone and install: `npm install`
2. Copy `.env.example` to `.env` and fill in all values
3. Run DB migration: `npx prisma migrate dev`
4. Start Trigger.dev dev server: `npx trigger.dev@latest dev`
5. Start Next.js: `npm run dev`

Open [http://localhost:3000](http://localhost:3000)

## Deployment
Deploy to Vercel. Add all env vars from `.env.example` to your Vercel project settings.
Deploy Trigger.dev tasks: `npx trigger.dev@latest deploy`
