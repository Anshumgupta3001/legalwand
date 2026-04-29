# Upload Functionality Overview

## What It Does

Allows users (and admins) to upload documents (PDF, DOCX, TXT) or provide a URL. The system extracts the text, converts it into vector embeddings, and stores them in a vector database so the content can be searched semantically by the AI chat feature.

---

## How It Works (Flow)

1. **User selects a file** — via the frontend; sent as `multipart/form-data`
2. **Request hits the backend** — Express route handles the incoming upload via `multer`
3. **Backend validates the file** — checks allowed MIME types (PDF, DOCX, TXT) and file size limits
4. **Text is extracted** — `pdf-parse` for PDFs, `mammoth` for DOCX, plain read for TXT
5. **Text is chunked & embedded** — split into ~800-character chunks; OpenAI generates vector embeddings for each chunk
6. **Vectors stored in Pinecone** — upserted in batches of 100 with metadata (filename, chunk index, timestamp)
7. **Response returned** — success/failure with chunk count and character count

---

## Key Components

- **Backend API** — Express + Multer (`/api/upload`, `/api/admin/upload`)
- **Storage** — Local disk (`server/uploads/`) for user files; memory buffer for admin uploads
- **Vector Database** — Pinecone stores embeddings for semantic search
- **Embeddings** — OpenAI `text-embedding-3-large` (1024 dimensions)
