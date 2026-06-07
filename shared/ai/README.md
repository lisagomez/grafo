# 🤖 AI Integration Module

Add AI-powered chat and text generation to your SaaS application.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Dependencies](#-dependencies)
3. [Environment Variables](#-environment-variables)
4. [Step-by-Step Setup](#-step-by-step-setup)
5. [API Reference](#-api-reference)
6. [Frontend Components](#-frontend-components)
7. [RAG (Document Search)](#-rag-document-search)
8. [Best Practices](#-best-practices)

---

## 🚀 Quick Start

```bash
# Add AI module
npx saas-factory add ai

# Install dependencies
cd backend && npm install openai ai

# Add your API key to .env
OPENAI_API_KEY=sk-...

# Start development
npm run dev
```

---

## 📦 Dependencies

### Backend (Node.js)

```bash
cd backend
npm install openai ai @ai-sdk/openai
```

### Frontend (Next.js)

```bash
cd frontend
npm install ai
```

---

## 🔧 Environment Variables

```env
# ================================
# AI Provider Configuration
# ================================
AI_PROVIDER=openai  # Options: openai, anthropic, google

# ================================
# OpenAI
# ================================
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview
# Other models: gpt-3.5-turbo, gpt-4, gpt-4-turbo-preview

# ================================
# Anthropic (Claude)
# ================================
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-opus-20240229
# Other models: claude-3-sonnet-20240229, claude-3-haiku-20240307

# ================================
# Google AI (Gemini)
# ================================
GOOGLE_AI_API_KEY=xxxxxxxxxxxxxxxxxxxx
GOOGLE_AI_MODEL=gemini-pro

# ================================
# Vector Database (for RAG)
# ================================
PINECONE_API_KEY=xxxxxxxxxxxxxxxxxxxx
PINECONE_INDEX=your-index-name
```

---

## 📝 Step-by-Step Setup

### Step 1: Get API Keys

**OpenAI:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to **API Keys**
3. Create new secret key
4. Add to `.env` as `OPENAI_API_KEY`

**Anthropic:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys**
3. Create new key
4. Add to `.env` as `ANTHROPIC_API_KEY`

### Step 2: Create AI Routes

```javascript
// backend/src/routes/ai.js
import express from 'express';
import { OpenAI } from 'openai';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Streaming chat endpoint
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages, systemPrompt } = req.body;

  try {
    const result = await streamText({
      model: openai('gpt-4-turbo-preview'),
      system: systemPrompt || 'You are a helpful assistant.',
      messages,
    });

    result.pipeTextStreamToResponse(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Non-streaming completion
router.post('/complete', authMiddleware, async (req, res) => {
  const { prompt, maxTokens = 1000 } = req.body;

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    });

    res.json({ 
      response: completion.choices[0].message.content,
      usage: completion.usage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 3: Register Routes

```javascript
// backend/src/index.js
import aiRoutes from './routes/ai.js';

app.use('/api/ai', aiRoutes);
```

### Step 4: Database Schema (Optional)

For conversation history:

```prisma
model Conversation {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  title     String?
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           String       // 'user', 'assistant', 'system'
  content        String       @db.Text
  createdAt      DateTime     @default(now())
}
```

---

## 📡 API Reference

### Chat (Streaming)

```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ],
  "systemPrompt": "You are a helpful assistant."
}
```

**Response:** Server-Sent Events (SSE) stream

### Complete (Non-Streaming)

```http
POST /api/ai/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Summarize this text...",
  "maxTokens": 500
}
```

**Response:**
```json
{
  "response": "Here is the summary...",
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 150,
    "total_tokens": 200
  }
}
```

---

## 🖥️ Frontend Components

### Chat Window Component

```tsx
// components/ai/ChatWindow.tsx
'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

export function ChatWindow() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/ai/chat',
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-primary-500 to-primary-600">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div className="text-white">
          <h3 className="font-semibold">AI Assistant</h3>
          <p className="text-sm opacity-80">Powered by GPT-4</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">How can I help you today?</h3>
            <p className="text-gray-400 mt-2">Ask me anything!</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user' 
                ? 'bg-primary-100' 
                : 'bg-gray-100'
            }`}>
              {message.role === 'user' 
                ? <User className="w-5 h-5 text-primary-600" />
                : <Bot className="w-5 h-5 text-gray-600" />
              }
            </div>
            
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              message.role === 'user'
                ? 'bg-primary-500 text-white rounded-tr-none'
                : 'bg-gray-100 text-gray-900 rounded-tl-none'
            }`}>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
```

### Usage in Page

```tsx
// app/dashboard/ai/page.tsx
import { ChatWindow } from '@/components/ai/ChatWindow';

export default function AIPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">AI Assistant</h1>
      <ChatWindow />
    </div>
  );
}
```

---

## 🔍 RAG (Document Search)

Add document-based context to your AI responses.

### Step 1: Set Up Pinecone

```bash
npm install @pinecone-database/pinecone
```

### Step 2: Create Vector Store

```javascript
// lib/vectorStore.js
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX);

// Generate embeddings
export async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Store document
export async function storeDocument(id, text, metadata = {}) {
  const embedding = await embedText(text);
  
  await index.upsert([{
    id,
    values: embedding,
    metadata: { text, ...metadata }
  }]);
}

// Search similar documents
export async function searchSimilar(query, topK = 5) {
  const embedding = await embedText(query);
  
  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true
  });
  
  return results.matches.map(match => ({
    text: match.metadata.text,
    score: match.score
  }));
}

// Chat with context
export async function chatWithContext(query, systemPrompt) {
  // Get relevant documents
  const docs = await searchSimilar(query, 3);
  const context = docs.map(d => d.text).join('\n\n---\n\n');
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nUse the following context to answer:\n\n${context}`
      },
      { role: 'user', content: query }
    ]
  });
  
  return response.choices[0].message.content;
}
```

---

## 🛡️ Best Practices

### 1. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many AI requests, please try again later'
});

app.use('/api/ai', aiLimiter);
```

### 2. Cost Control

```javascript
// Track token usage
router.post('/chat', async (req, res) => {
  // ... AI call ...
  
  // Log usage
  await prisma.aiUsage.create({
    data: {
      userId: req.user.id,
      model: 'gpt-4-turbo-preview',
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      cost: calculateCost(usage)
    }
  });
});
```

### 3. Content Moderation

```javascript
// Moderate user input before sending to AI
const moderation = await openai.moderations.create({
  input: userMessage
});

if (moderation.results[0].flagged) {
  return res.status(400).json({ error: 'Inappropriate content detected' });
}
```

---

## 📊 Model Comparison

| Model | Provider | Context | Speed | Cost |
|-------|----------|---------|-------|------|
| GPT-4 Turbo | OpenAI | 128K | Fast | $$$ |
| GPT-3.5 Turbo | OpenAI | 16K | Very Fast | $ |
| Claude 3 Opus | Anthropic | 200K | Medium | $$$ |
| Claude 3 Sonnet | Anthropic | 200K | Fast | $$ |
| Gemini Pro | Google | 32K | Fast | $$ |

---

## ❓ Troubleshooting

### "Invalid API key"
- Verify API key is correct in `.env`
- Check for leading/trailing whitespace

### Streaming not working
- Ensure `res` is not modified before streaming
- Check CORS settings

### Context too long
- Implement chunking for long conversations
- Use summarization for old messages

---

## 📚 Resources

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Pinecone Docs](https://docs.pinecone.io)
