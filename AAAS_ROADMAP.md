# AAAS Implementation Roadmap & Architecture

This document outlines the step-by-step transformation of the current "Attendance Register" into the **AI Automated Attendance System (AAAS)**.

## 🌟 Strategic Vision
To create a "Zero-Touch", AI-first attendance system where students are marked present purely by walking into the room or looking at a kiosk, backed by automated intelligent workflows.

---

## 🏗️ Phase 1: AI Face Recognition (The "Eyes")
**Goal:** Enable "Face Login" for attendance to eliminate proxy attendance.

### 1.1 Face Recognition Kiosk (Frontend)
- [ ] **Tech:** `face-api.js` (Client-side TensorFlow wrapper).
- [ ] **Feature:** "Smart Kiosk" Mode page (`/kiosk`).
- [ ] **Workflow:**
    1.  Admin launches Kiosk Mode on a laptop/tablet.
    2.  Camera stream continuously scans for faces.
    3.  **Real-time Recognition:** Matches face against registered student variants.
    4.  **Action:** Automatically submits attendance API call on match.
    5.  **Feedback:** Text-to-Speech "Welcome, [Name]".

### 1.2 Student Face Registration (Onboarding)
- [ ] **Feature:** Add "Face Data" field to Student Profile.
- [ ] **UI:** New page for students/admins to capture 3-5 reference photos.
- [ ] **Storage:** Store the "Face Descriptor" (128-float array) in the JSON column of the `students` table (PostgreSQL/SQLite).

---

## 🧠 Phase 2: Intelligent Automation (The "Brain")
**Goal:** Replace manual admin tasks with event-driven workflows.

### 2.1 Attendance Rules Engine
- [ ] **Server Logic:** Middleware to check timestamp vs Session Start Time.
- [ ] **Rules:**
    -   *Late:* Entry > 10 mins after start.
    -   *Truant:* No exit time (if strictly tracking duration).
    -   *Proxy:* Block same IP/deviceId for multiple different faces (Hard Check).

### 2.2 Webhook & Notifications (Simulated n8n)
- [ ] **Architecture:** Since we are running locally, we will build a lightweight "Workflow Dispatcher" in Node.js.
- [ ] **Triggers:**
    -   `ON_ATTENDANCE_MARKED` -> Check if "Late" -> Send Email.
    -   `ON_ABSENT_THRESHOLD_REACHED` -> Alert Counselor.

---

## 🔮 Phase 3: AI Analyst & Chatbot (The "Voice")
**Goal:** Allow administrators to "talk" to their data.

### 3.1 AI Summary Generator
- [ ] **Tech:** OpenAI API / Anthropic API Integration.
- [ ] **Feature:** "Generate Daily Report" button.
- [ ] **Prompt Engineering:** passing raw JSON attendance logs to LLM to get a "Risk Analysis Summary" in Markdown.

### 3.2 Admin Chatbot (RAG)
- [ ] **Interface:** Floating Chat Widget for Admins.
- [ ] **Capability:** Answer "Who was late most often this month?" by converting NLP to SQL or filtering JSON data.

---

## 🛠️ Technical Architecture Changes

### Frontend (React)
-   Install `face-api.js`.
-   Add `FaceCapture` component.
-   Add `Kiosk` page.

### Backend (Node/Express)
-   Update `students` schema: Add `faceDescriptor` (JSON).
-   Add `/api/ai/summarize` endpoint.
-   Add `/api/automation/trigger` logic.

### Database (SQLite)
-   No major migration needed, just schema update for JSON storage.

---

## 📅 Execution Plan (Next Steps)

1.  **Install AI Dependencies**: `face-api.js`.
2.  **Create Face Registration Page**: Allow collecting the face data.
3.  **Create Kiosk Page**: The actual scanner.
4.  **Connect to Backend**: Save and Load face descriptors.
