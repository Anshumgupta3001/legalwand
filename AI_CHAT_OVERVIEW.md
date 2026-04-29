# AI Chat Overview

## What It Does

Allows users to ask plain-language questions about GST law and uploaded legal documents. The AI retrieves the most relevant content from the knowledge base and generates a detailed, structured answer grounded in that context.

---

## How It Works (Flow)

1. **User asks a question** in the chat interface
2. **Query expansion** — short or keyword queries are automatically expanded into variations to improve search coverage
3. **Embedding** — the question (and its variants) are converted into vector embeddings via OpenAI
4. **Pinecone search** — embeddings are matched against the indexed document chunks; results are merged and ranked by relevance score
5. **Context assembly** — the top-scoring chunks are collected up to a token budget (~12,000 characters)
6. **Answer generation** — the context plus the original question are sent to OpenAI (GPT-4o-mini), which produces a structured response covering background, key points, and practical impact
7. **Response delivered** — the answer is saved to chat history and returned to the user along with source references

---

## Key Components

- **OpenAI** — query expansion, vector embeddings, and final answer generation
- **Pinecone** — vector database for semantic search across document chunks
- **MongoDB** — stores chat history, user accounts, and document metadata
- **Backend API** — Express routes orchestrate the full RAG pipeline and enforce credit limits
