# ai-receptionist-lead-engine
AI Receptionist &amp; Lead Conversion Engine with Hindsight Memory

# 🤖 AI Receptionist & Lead Conversion Engine

> Smart Conversations · Long-Term Memory · Lead Scoring · Automated Follow-ups

An AI-powered receptionist that **never forgets a customer** — built with Hindsight memory, 
QWEN-3 8B, FastAPI, and React.

---

## 🧠 How It Works

1. Customer contacts via WhatsApp / Chat / Phone / Telegram
2. AI understands intent, sentiment, budget & constraints
3. **Hindsight** saves everything to long-term memory
4. Lead Scoring Engine scores 0–100 (90+ = 🔥 Hot Lead)
5. Auto follow-up scheduled if customer says "I'll think about it"
6. Dashboard shows full picture to Employee & CEO

---

## 🗂️ Project Structure
ai-receptionist-lead-engine/

├── backend/        ← G: FastAPI + Groq AI + Lead Scorer

├── frontend/       ← J: Chat UI + Dashboards

├── data/           ← Y: Customer profiles + KB + Scripts

├── setup/          ← D: Hindsight config + seed data

└── README.md

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Model | QWEN-3 8B via Groq |
| Memory | Hindsight by Vectorize |
| Backend | Python + FastAPI |
| Frontend | React.js / HTML + CSS |
| Data | Synthetic Indian customer profiles |

---

## 🚀 Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/ai-receptionist-lead-engine.git
cd ai-receptionist-lead-engine
```

### 2. Backend setup (G)
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 3. Load demo data (D)
```bash
cd setup
python seed_data.py
```

### 4. Open frontend (J)
Open `frontend/chat.html` in your browser.

---

## 👥 Team

| Member | Role |
|--------|------|
| D | Project Lead + Hindsight Setup + Integration |
| G | Backend Developer (AI + API) |
| J | Frontend Developer (UI + Dashboards) |
| Y | Data + Content + Documentation |

---

## 🔗 Links

- [Hindsight by Vectorize](https://hindsight.vectorize.io)
- [Hindsight GitHub](https://github.com/vectorize-io/hindsight)
