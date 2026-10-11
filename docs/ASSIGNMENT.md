# UnsaidTalks — Mentor–Mentee Chat Portal

> Project Assignment: Mentor–Mentee Chat Portal

---

## 🎯 Objective

Build a web-based chat portal where:

- Mentors and mentees talk in **program groups**, AND
- Hold **one-to-one conversations**

inside the UnsaidTalks platform, with **real-time messaging** and **role-based access**.

---

## ❓ Problem Context

Mentors and mentees currently talk on WhatsApp groups. This causes:

- Personal phone numbers exposed to everyone in the group
- Announcements and doubts buried under casual messages
- No link between conversations and a program, batch or mentor on our platform
- No moderation, search or record of conversations
- Late joiners cannot see earlier discussions

The goal is to move these conversations to our web platform, with the ease of WhatsApp but built for mentorship.

---

## ✅ Core Requirements

### 1. Authentication & Roles

Support:

- Sign up and log in (email + password, JWT)
- Three roles: **Admin**, **Mentor**, **Mentee**
- Each role sees only its own groups and chats

### 2. Mentorship Groups (replaces WhatsApp groups)

- Admin creates a group per program or batch (e.g. "TCS NQT Prep – Batch 12")
- Admin adds mentors and mentees to a group
- Chat list shows last message and unread count
- New members can read earlier messages

### 3. Real-Time Messaging (Mandatory Constraint)

- Use **WebSockets** (Socket.IO / Nest.js Gateway), not polling
- Messages appear instantly for all members, without refresh
- Each message shows:
  - Sender name and role badge (Mentor/Mentee)
  - Timestamp
- Messages stored in a database and reloaded after refresh
- Older messages load on scroll (pagination)
- Typing indicator and online/offline status

### 4. One-to-One Chat

- Mentee can start a private chat with a mentor of their group
- Mentor can message any mentee in their groups
- Mentee-to-mentee private chat is off by default

### 5. Mentor Tools (Key Requirement)

Make the chat work for mentorship, not just conversation:

- **Announcements:** mentor posts highlighted messages
- **Pin messages:** keep links and schedules at the top of a group
- **Doubts:** mentee marks a message as a doubt; mentor marks it resolved
- **Reply to message:** quote a specific message, like WhatsApp

### 6. File Sharing

- Share images and PDFs (max 5 MB)
- Inline preview for images; download link for PDFs

### 7. Notifications & Moderation

- Unread counts per chat
- In-app notification on replies and announcements
- Users delete their own messages; mentors/admins delete any message in their groups
- Report a message; reported messages appear on an admin screen
- No phone numbers or personal emails shown to other users

### 8. Architecture Expectations

Design for:

- Clear separation:
  - Auth and roles
  - Chat REST APIs (groups, history)
  - Real-time gateway (WebSockets)
  - Frontend UI
- Database schema for users, groups, members and messages
- Seed script with sample users, groups and messages
- Responsive UI (most students use phones)

---

## 🛠️ Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | React 17 + TypeScript                        |
| Backend    | Nest.js                                      |
| Real-time  | Socket.IO                                    |
| Database   | PostgreSQL or MongoDB *(explain your choice in the README)* |

---

## ⭐ Bonus Considerations

- [ ] WhatsApp import: upload an exported chat (.txt) and convert it into a group's history
- [ ] AI summary of unresolved doubts for the mentor
- [ ] Message search within a group
- [ ] Read receipts and emoji reactions
- [ ] Edit a message within 5 minutes
- [ ] Browser push notifications
- [ ] Deployed live link (Vercel, Render, Railway)

---

## 📦 Deliverables

- GitHub repository (public)
- Architecture diagram and database schema
- README covering:
  - Setup steps and sample login credentials
  - Real-time design (how WebSocket events and rooms work)
  - Features completed and pending
- Demo video or in-person demo and walkthrough, showing mentor and mentee on **two browsers** chatting live

---

## 📊 Evaluation Criteria

- Reliability of real-time messaging
- Correct role-based access (who can see and do what)
- Mentorship features (announcements, pins, doubts)
- UX quality, especially on mobile
- Code structure and system scalability

---

## 📚 Suggested References

- [Socket.IO documentation](https://socket.io/docs/)
- [Nest.js WebSocket Gateways](https://docs.nestjs.com/websockets/gateways)
- JWT authentication in Nest.js
- Chat database schema design best practices
- WhatsApp Web (as a UX benchmark)

---

<p align="center"><a href="https://www.unsaidtalks.com">www.unsaidtalks.com</a></p>
