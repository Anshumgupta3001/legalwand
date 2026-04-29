# GSTWand — Full-Stack Authentication Application

A complete full-stack authentication application for the GSTWand GST compliance platform. Built with React + Vite (frontend) and Node.js + Express + MongoDB (backend).

## Project Structure

```
GST/
├── client/          # React + Vite + Tailwind frontend
└── server/          # Node.js + Express + MongoDB backend
```

## Tech Stack

### Frontend
- **React 18** with React Router v6
- **Vite** (build tool)
- **Tailwind CSS v3** with custom design tokens
- **Axios** for API calls
- **Google Fonts**: Playfair Display + DM Sans

### Backend
- **Node.js + Express**
- **MongoDB** with Mongoose
- **JWT** authentication
- **bcryptjs** password hashing
- **Nodemailer** for email (OTP + password reset)
- **express-validator** for input validation

## Features

- Sign In (Email / Mobile / GSTIN)
- Sign Up with GSTIN verification
- Forgot Password with CAPTCHA
- OTP Verification with countdown timer
- JWT-based session management
- Password strength meter
- Responsive design (mobile-first, left panel hidden on small screens)

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Gmail account (for sending emails)

### Backend Setup

```bash
cd server
npm install

# Edit .env with your actual values:
# - MONGO_URI (your MongoDB connection string)
# - JWT_SECRET (random secret key)
# - EMAIL_USER / EMAIL_PASS (Gmail + App Password)

npm run dev   # Development with nodemon
npm start     # Production
```

The server runs on `http://localhost:5000`.

### Frontend Setup

```bash
cd client
npm install
npm run dev   # Development server on http://localhost:5173
npm run build # Production build
```

### Environment Variables

#### server/.env
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection URI |
| `JWT_SECRET` | Secret key for JWT signing |
| `JWT_EXPIRE` | JWT expiry duration (e.g., 7d) |
| `OTP_SECRET` | Secret key for OTP generation |
| `EMAIL_HOST` | SMTP host (e.g., smtp.gmail.com) |
| `EMAIL_PORT` | SMTP port (587 for TLS) |
| `EMAIL_USER` | SMTP email address |
| `EMAIL_PASS` | SMTP app password |
| `EMAIL_FROM` | From address for emails |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/forgot-password` | Send password reset link |
| POST | `/api/auth/verify-otp` | Verify OTP and activate account |
| POST | `/api/auth/resend-otp` | Resend OTP to email |
| GET | `/health` | Health check |

## Design System

Uses a warm parchment/terracotta color palette:

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#f7f4ef` | App background |
| `bg-panel` | `#f2ede6` | Left panel |
| `acc` | `#BC6C5F` | Primary accent (dusty rose-terracotta) |
| `ok` | `#5a9a7a` | Success states |
| `err` | `#c0392b` | Error states |
| `warn` | `#b8860b` | Warning states |

## Security Features

- Passwords hashed with bcrypt (12 salt rounds)
- JWT tokens with configurable expiry
- OTP expires in 10 minutes
- Password reset links expire in 1 hour
- GSTIN cross-verification for password resets
- CAPTCHA on forgot password form
- 256-bit SSL, SOC 2 Type II, GSTN Approved
