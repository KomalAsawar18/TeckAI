# TeckAI - Intelligent Technology E-commerce & AI Assistant

TeckAI is a modern, high-performance technology e-commerce application featuring a database-grounded **AI Shopping Assistant** powered by Google Gemini. The application is built with a decoupled architecture containing a Node/Express backend API and a React (Vite) frontend.

---

## 🔗 Live Deployments

- **Frontend Application:** [https://teckai-frontend.vercel.app/](https://teckai-frontend.vercel.app/)
- **AI Shopping Assistant:** [https://teckai-frontend.vercel.app/ai-assistant](https://teckai-frontend.vercel.app/ai-assistant)
- **Backend API Server:** [https://teckai-backend.vercel.app/health](https://teckai-backend.vercel.app/health)

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** MongoDB Atlas (hosted cloud database)
- **ORM:** Mongoose
- **Logging:** Winston Logger (structured JSON in production)
- **AI Platform:** Google Gemini REST API (model: `gemini-3.6-flash`)

### Frontend
- **Bundler:** Vite
- **UI Library:** React (v18+)
- **Routing:** React Router DOM (v6)
- **Icons:** Lucide React
- **Styles:** Vanilla CSS with a centralized CSS custom property (design token) system.

---

## 📐 Architecture Overview

The backend is built as a **Modular Monolith** implementing the **Controller-Service-Repository** design pattern. This pattern keeps the application logic strictly separated, highly testable, and maintainable.

```text
HTTP Request  →  Router (aiRoutes)
              →  Controller (AiController - handles HTTP / validations)
              →  Service (RecommendationService - orchestrates logic)
              →  Repository (ProductRepository - database commands)
              →  MongoDB Atlas / Mongoose
```

- **Routes:** Define endpoints and attach middleware (e.g. rate limiters).
- **Controllers:** Parse HTTP requests, validate query/body variables, and return formatted responses.
- **Services:** Implement core business workflows (e.g. query extraction, text parsing).
- **Repositories:** Manage database transactions and encapsulate Mongoose queries.

---

## 🤖 AI Shopping Assistant (Grounded & Sandboxed)

The AI assistant uses a multi-turn grounding architecture to prevent model hallucinations and ensure product information matches our live inventory state:

```text
User Message  →  Intent Extraction (Gemini prompt parser)
              →  Mongoose DB Search (Price, Specs, Brand, Keywords)
              →  Grounding Assembly (Matched DB records mapped into context)
              →  Grounded Generation (Gemini synthesizes structured JSON)
              →  Response Parsing (Fallback handlers format narrative + comparison matrix)
              →  Interactive Chat Bubble UI
```

### Safety & Abuse Guardrails
1. **Length Validation:** Inputs are capped at 500 characters.
2. **IP Rate Limiting:** Requests are throttled at 5 requests/minute per client IP.
3. **Mongoose Grounding:** The model is strictly constrained to only recommend products returned by MongoDB queries.
4. **Offline Mock Tests:** Mock utilities allow testing the JSON parser and DB pipelines without consuming Gemini API tokens.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```ini
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/teckai
GEMINI_API_KEY=AIzaSy...
CORS_ORIGIN=http://localhost:5173,https://teckai-frontend.vercel.app
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```ini
VITE_API_URL=http://localhost:5000/api
```

---

## 🚀 Local Installation & Setup

### Prerequisites
- Node.js (v18+)
- Local MongoDB or MongoDB Atlas credentials.
- Google Gemini API Key.

### 1. Backend Setup
```bash
cd backend
npm install
# Create .env and configure environment variables
npm run seed  # Seed the Atlas cluster with 21 core products
npm run dev   # Run the server in watch mode
```

### 2. Frontend Setup
```bash
cd frontend
npm install
# Create .env and set VITE_API_URL
npm run dev   # Start Vite dev server on http://localhost:5173
```

---

## 🧪 Available Scripts

### Backend (`/backend`)
- `npm start`: Starts the API server in production.
- `npm run dev`: Starts the API server with nodemon.
- `npm run seed`: Clears catalog and seeds 21 products and categories.
- `npm test`: Runs the Jest integration test suite (using the remote test cluster).
- `node scripts/test-ai.js`: Tests real query parser and grounded recommendation steps.
- `node scripts/test-ai-mock.js`: Runs mock Gemini parser and database validations locally.

### Frontend (`/frontend`)
- `npm run dev`: Starts local Vite developer server.
- `npm run build`: Compiles production bundle using Rollup.
- `npm run preview`: Previews the compiled production bundle locally.

---

## 🌐 Backend Endpoints

| Method | Endpoint | Description | Validation |
| :--- | :--- | :--- | :--- |
| **GET** | `/health` | Server status and connection healthcheck | None |
| **GET** | `/api/products` | Paginated, filtered catalog query | validates query parameters (`page`, `limit`, `minPrice`, `maxPrice`) |
| **GET** | `/api/products/:slug` | Retrieve single product details | validates `slug` presence |
| **GET** | `/api/categories` | Fetch active category filter aggregations | None |
| **POST**| `/api/ai/chat` | AI Shopping Assistant chat turn | Rate limited; validates message presence and length (max 500 chars) |
