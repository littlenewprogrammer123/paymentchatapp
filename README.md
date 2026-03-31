# 💬 MERN Chat & Payments App

A full-stack MERN application featuring real-time encrypted chat and a payments dashboard built for a technical interview demonstration.

## ✨ Features

- 🔐 AES-256-CBC encrypted messages stored in MongoDB
- 💬 Real-time chat using Socket.io WebSockets
- 🔑 JWT authentication (register & login)
- 💳 Payments dashboard with MongoDB aggregation joins
- 📎 Binary file attachments in chat
- 📊 MongoDB indexes for performance
- 👤 Role-based access (admin / user)

## 🛠️ Tech Stack

- **Frontend:** React, Socket.io-client, Axios, React Router
- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB (local), Mongoose
- **Auth:** JWT + bcrypt
- **Encryption:** Node.js crypto (AES-256-CBC)

## 🚀 Getting Started

### Prerequisites

- Node.js installed
- MongoDB installed and running locally
- Git

### Setup

1. Clone the repository
```
   git clone https://github.com/littlenewprogrammer123/paymentchatapp.git
   cd paymentchatapp
```

2. Setup backend environment
```
   cd backend
   copy .env.example .env
```
   Then open `backend/.env` and fill in your values.

3. Start the application
```
   start.bat
```
   This launches both frontend (port 3000) and backend (port 5000) automatically.

## 🔐 Environment Variables

See `backend/.env.example` for all required variables.

| Variable | Description |
|---|---|
| `PORT` | Backend server port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `ENCRYPTION_KEY` | 32-character AES-256 encryption key |
| `ENCRYPTION_IV` | 16-character initialization vector |

## 📁 Project Structure
```
paymentchatapp/
├── start.bat              # Start both servers
├── README.md
├── backend/
│   ├── .env.example       # Environment template
│   ├── server.js
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── controllers/
│   └── utils/
│       └── encryption.js
└── frontend/
    └── src/
        ├── pages/
        └── components/
```

## 🔒 Security Notes

- `.env` file is gitignored — never committed to repo
- All messages encrypted before DB storage
- Passwords hashed with bcrypt (never encrypted)
- JWT verified on every protected route and socket connection