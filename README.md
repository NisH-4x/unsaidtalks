# UnsaidTalks — Mentor–Mentee Chat Portal

A web chat portal where mentors and mentees talk in program groups and one-to-one chats, with real-time messaging, role-based access and mentorship tools (announcements, pinned messages, doubt tracking). The original assignment brief is in [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

## Features completed and pending

Every core requirement in the brief is implemented, along with five of the seven bonus items and part of a sixth. Everything is covered by automated tests: unit tests, API tests against a real database and browser tests on desktop and phone screens.

| Core requirement                                                                                                                         | Status |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Authentication and roles: email and password, JWT, Admin / Mentor / Mentee, mentor approval                                              | Done   |
| Mentorship groups: created by admins, members added by admins, last message and unread count, full history for late joiners              | Done   |
| Real-time messaging over WebSockets: role badges, timestamps, stored history, pagination, typing, online status                          | Done   |
| One-to-one chats with the brief's rules (mentee-to-mentee off by default)                                                                | Done   |
| Mentor tools: announcements, pinned messages, doubts, replies                                                                            | Done   |
| File sharing: images and PDFs up to 5 MB, inline images, PDF download                                                                    | Done   |
| Notifications and moderation: unread counts, reply and announcement notifications, deleting, reporting, no emails or phone numbers shown | Done   |
| Architecture: separated layers, database schema, seed script, responsive UI                                                              | Done   |

| Bonus                             | Status                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp chat import (.txt)       | Done                                                                                                                                               |
| AI summary of unresolved doubts   | Done (Groq)                                                                                                                                        |
| Message search within a group     | Done (works in private chats too)                                                                                                                  |
| Read receipts and emoji reactions | Done                                                                                                                                               |
| Edit a message within 5 minutes   | Done                                                                                                                                               |
| Browser push notifications        | Partly: desktop notifications while the app is open in a tab (Notification API). Push to a closed browser (service worker, Web Push) is not built. |
| Deployed live link                | Ready to deploy: Render and Vercel configuration and steps are in [Deploying](#deploying-render--vercel). The live link is added after deployment. |

**Still to do:** deploy and add the live link, and record the demo video.

**Documentation:** [Architecture](docs/ARCHITECTURE.md) (system diagram, modules, message flow, sessions, where rules are enforced), [Database schema](docs/DATABASE.md) (collections, fields, indexes, relations) and the original [assignment brief](docs/ASSIGNMENT.md).

## Tech stack

| Layer     | Technology                                            |
| --------- | ----------------------------------------------------- |
| Frontend  | React 17, TypeScript, Vite, Tailwind CSS, Zustand     |
| Backend   | NestJS 11, TypeScript                                 |
| Real-time | Socket.IO (NestJS WebSocket gateway)                  |
| Database  | MongoDB Atlas with Mongoose; GridFS for file uploads  |
| Testing   | Jest, Supertest, Socket.IO client, Vitest, Playwright |
| AI        | Groq API (doubt summaries)                            |
| Hosting   | Vercel (frontend), Render (backend), MongoDB Atlas    |

### Why MongoDB

- A chat message is naturally one document: text plus an optional attachment, reply quote and doubt status. It is read in one go without joins.
- The most frequent query, "the 30 messages before this one in conversation X", is served by a single compound index on `(conversationId, _id)`.
- Optional fields such as reactions or edit history can be added without schema migrations.
- Collections can later be sharded by conversation for horizontal scale.
- Trade-off: there are no foreign keys, so integrity is enforced with unique indexes, schema validation and service-layer checks.

## Authentication and roles

- **Roles:** Admin, Mentor and Mentee. People choose Mentee or Mentor when they sign up. Mentees can use the app immediately; mentor accounts stay _pending_ until an admin approves them on the **Mentor requests** screen. Admin accounts cannot be created through signup.
- **Tokens:** signing in returns a 15-minute JWT access token, kept only in memory by the web app, and sets a 7-day refresh token in an `httpOnly`, `SameSite=Strict` cookie that JavaScript cannot read. The server stores only a SHA-256 hash of each refresh token, rotates it on every use and ends all of a user's sessions if an already-used token is presented again.
- **Authorization on the server:** every API route requires a signed-in user unless it is explicitly public. A global guard re-checks the account on each request, so deactivating or rejecting an account takes effect immediately; a roles guard protects admin routes.
- **Privacy:** other users never receive anyone's email address. Emails are visible only to the user themselves and to admins in the admin screens. Phone numbers are not collected.
- **Abuse protection:** sign-in and signup are limited to 10 attempts per minute per IP address; passwords are hashed with bcrypt.

## Groups and access rules

- **Program groups:** admins create one group per program or batch (for example "TCS NQT Prep – Batch 12"), edit its details, and add or remove mentors and mentees. Only active mentors and mentees can be added. Adding, removing and creating are recorded in the chat as short notes ("Ananya Rao added Rahul Verma").
- **Chat list:** every user sees only the groups and direct chats they belong to, with the last message, its time and their unread count. A person added later starts with nothing unread but can read the full history.
- **Who can open what:** members open their own conversations. Admins can also open any group as a moderator (follow it live and post in it) from the admin screens, but never anyone's private direct chat. For anything else the API answers `404 Not found`, so it does not even reveal that the conversation exists.
- **User management:** admins can search all users, switch a person between mentor and mentee, and deactivate or reactivate accounts. Deactivation ends that person's sessions immediately.

### One-to-one chats

| Who                 | May start a private chat with                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Mentee              | Mentors who share a program group with them                                                       |
| Mentor              | Mentees and co-mentors who share a program group with them                                        |
| Mentee → mentee     | Only if a group they share has "Allow mentees to message each other" switched on (off by default) |
| Admin               | Any active user                                                                                   |
| Anyone else → admin | Not allowed; ask in the group instead                                                             |

- Start a chat from **New chat** in the chat list (it lists only the people you may message) or from the message button next to a member in **Group info**.
- Opening a chat with someone you already talk to returns the existing chat. A unique key per pair of people prevents duplicates even if both start one at the same moment.
- The other person sees the new chat when its first message arrives, as on WhatsApp.
- If two people stop sharing a group (for example, a mentee is removed from a batch), their chat stays readable but becomes read-only; the server refuses new messages in it. Chats with an admin stay open.

All of these rules are enforced on the server. The permission rules live in one place (`backend/src/modules/access/access-policy.ts`) and are covered by table-driven unit tests.

## Mentor tools

| Tool             | Who can use it                          | How                                                                                                                             |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Announcements    | Mentors and admins, in groups           | Megaphone button next to the message box. Announcements get a highlighted card and are listed in **Group info → Announcements** |
| Pinned messages  | Mentors and admins, in groups (max. 5)  | **Pin to top** in a message's menu. A bar under the header shows the pins; tapping it opens each one in turn                    |
| Doubts           | Mentees ask, in groups                  | **Ask as doubt** button next to the message box, or **Mark as doubt** on one of their own messages                              |
| Resolving doubts | Mentors and admins                      | **Mark resolved** / **Reopen** in the message menu or in **Group info → Doubts** (filter: Open, Resolved, All)                  |
| Reply / quote    | Anyone who can post in the conversation | **Reply** in a message's menu. The reply shows a quote of the original; tapping the quote scrolls back to it                    |

- **Message menu:** the arrow next to each message opens its actions. It appears on hover with a mouse and is always shown on touch screens; on phones, touching and holding a message also opens it. On larger screens it opens as a dropdown over the message; on phones it slides up from the bottom of the screen with large reaction buttons. Only actions the server will accept from that person are offered.
- **Jumping to a message:** opening a pin, a doubt, an announcement or a reply quote loads older history as needed (up to 2,000 messages back), scrolls to the message and briefly highlights it.
- **Live updates:** pinning, unpinning, editing, reacting and changing a doubt's status are broadcast to the conversation as `message:updated`, so every member's bubbles, pinned bar and open lists update without a refresh.
- **Server checks:** a doubt must be the mentee's own message in a group; announcements and doubts cannot be combined; a reply must point to a message in the same conversation that has not been deleted; actions on a message the user cannot see answer `404`. The quote is saved with the reply, so it stays readable when the original is far back in the history.

| Method            | Path                                                  | Purpose                                                |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `GET`             | `/api/conversations/:id/pins`                         | Pinned messages, most recently pinned first            |
| `GET`             | `/api/conversations/:id/doubts?status=open\|resolved` | Doubts, newest first                                   |
| `GET`             | `/api/conversations/:id/announcements`                | Announcements, newest first                            |
| `POST` / `DELETE` | `/api/messages/:id/pin`                               | Pin or unpin                                           |
| `POST` / `DELETE` | `/api/messages/:id/doubt`                             | Mentee marks or unmarks their own message as a doubt   |
| `PATCH`           | `/api/messages/:id/doubt`                             | `{ status: "resolved" \| "open" }`, mentors and admins |

## File sharing

- **What can be shared:** images (JPEG, PNG, WebP, GIF) and PDFs up to 5 MB, in groups and private chats, with an optional caption. Use the paperclip button, paste a screenshot into the message box, or drop a file onto it.
- **How it looks:** images appear in the chat and open full screen when tapped; PDFs appear as a card with the file name, size and a download button. Every attachment can also be downloaded from its message menu.
- **Mentor tools still apply:** a file can be a reply, an announcement or a mentee's doubt (for example a screenshot of a question), and can be pinned or resolved like any other message.
- **Upload progress:** the message appears straight away with a progress indicator. A failed upload shows Retry and Discard; a retry reuses the same `clientId`, so the server stores the file only once even if the first attempt actually succeeded.

How it works and why:

1. The browser sends the file and the message options in one `multipart/form-data` request to `POST /api/conversations/:id/attachments`. Files go over HTTP rather than the socket so that large uploads show progress and never hold up chat messages.
2. The server keeps the upload in memory (at most 5 MB; larger requests are cut off with `413`) and identifies its type from the first bytes of the content. The type the browser reports is ignored, so an HTML or SVG file renamed to `.png` is refused with `415`. The file name is cleaned (no folders, control characters or reserved characters) and given an extension that matches the real type.
3. All the usual checks run before anything is stored: membership, read-only private chats, who may post announcements or doubts, and that a quoted message belongs to the same conversation.
4. The file is written to MongoDB **GridFS** (bucket `attachments`), then the message is created. If creating the message fails, the stored file is deleted again. The message is broadcast as `message:new`, exactly like a text message.
5. Files are read through `GET /api/messages/:id/attachment`, which applies the same access rules as the conversation (others get `404`) and stops serving a file once its message is deleted. Images are sent `inline` and PDFs as `attachment` (download), with `X-Content-Type-Options: nosniff` and a stored, verified content type. Responses carry an `ETag` with `Cache-Control: private, no-cache`, so a browser can reuse its copy, but only after the access check passes again.
6. Because the access token lives in memory rather than in a cookie, the web app fetches files with the token and shows them through temporary `blob:` URLs, which it releases when they are no longer on screen. Tokens never appear in file URLs or server logs.

Image width and height are sent by the uploader's browser and stored only to reserve space while an image loads, so the chat does not jump; they are never trusted for anything else.

## Notifications and moderation

### In-app notifications

| Notification   | Who gets it                                                                |
| -------------- | -------------------------------------------------------------------------- |
| Reply          | The author of the quoted message (not for replying to yourself)            |
| Announcement   | Every other member of the group                                            |
| Doubt resolved | The mentee who asked; resolving the same doubt again does not notify twice |

- **Where they appear:** a bell in the header with the unread count, and a list (a dropdown on computers, full screen on phones). Choosing a notification opens the conversation at that message and highlights it. If you are not looking at that chat when a notification arrives, a toast with a **View** button appears too.
- **Live:** notifications are stored, then sent to every open tab of the person (`notification:new`). Reading them in one tab updates the others (`notifications:read`).
- **Reading:** opening a notification, choosing **Mark all as read**, or simply opening the conversation marks them read.
- **Never slows down chat:** notifications are created after the message has been delivered, in a separate step. If creating one fails, the error is logged and the message is unaffected.
- **Chat unread counts** are separate from notifications and stay per conversation.
- **Desktop notifications** can be switched on as well; see [Desktop notifications](#desktop-notifications).

### Deleting messages

| Who           | Can delete                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| Anyone        | Their own messages, in groups and private chats                                |
| Mentor, admin | Any message in a program group (admins also in groups they are not members of) |
| Nobody        | The other person's messages in a private chat, or system notes                 |

Deleting is "for everyone": the message keeps its place and shows "This message was deleted", or "removed by a mentor or admin" when someone else deleted it. The server then removes the text and file from the message, stops replies from quoting it, unpins it, updates the chat-list preview, takes it out of unread counts (sending `conversation:unread` to the people affected) and deletes the notifications that pointed to it. The file is erased from storage too, unless the message has been reported, in which case admins can still review it.

### Reporting messages

- **Who:** anyone except the sender can report a message they can see, once. Admins delete messages directly instead. Reasons: spam, abuse or harassment, sharing someone's personal information, or something else, with an optional note.
- **What is kept:** each report stores a copy of the message (sender, text and file details) taken at that moment, so admins can review it even if the sender deletes it afterwards.
- **Admin screen (Admin → Reports):** reports are grouped by message, newest first, with the conversation, the sender, every reporter's reason and note, and an open count on the tab. An admin can **Delete message** (for everyone) or **Dismiss** the reports; either closes all open reports on that message and records who decided and when. Closed reports remain under **Removed** and **Dismissed**.
- **Private chats:** admins can never open private chats, but they see the reported message itself and can delete it from the reports screen.
- **Privacy:** reporters' and senders' email addresses appear only on this admin screen. Other users never see anyone's email address, and phone numbers are not collected.

| Method   | Path                                       | Purpose                                                        |
| -------- | ------------------------------------------ | -------------------------------------------------------------- |
| `DELETE` | `/api/messages/:id`                        | Delete a message for everyone                                  |
| `POST`   | `/api/messages/:id/report`                 | `{ reason, note? }`                                            |
| `GET`    | `/api/notifications?before=`               | Newest 20 notifications and the unread count                   |
| `POST`   | `/api/notifications/read`                  | `{ ids? }`: mark some, or all, as read                         |
| `GET`    | `/api/admin/reports?status=`               | Reported messages: `open`, `actioned` (removed) or `dismissed` |
| `GET`    | `/api/admin/reports/open-count`            | Number of messages waiting for review                          |
| `PATCH`  | `/api/admin/reports/:messageId`            | `{ decision: "dismiss" \| "remove-message" }`                  |
| `GET`    | `/api/admin/reports/:messageId/attachment` | The reported file, kept for review                             |

## Bonus features

### Message search

- **Where:** the magnifier in a conversation's header opens a search panel (full screen on phones, a side panel on wide screens). It works in groups and private chats for anyone who can open the conversation; others get `404`.
- **How it matches:** a MongoDB text index on message text and file names, scoped to the conversation, so a search never scans other chats. Matching is by whole words with English stemming ("interviews" finds "interview"), case-insensitive; deleted messages and system notes are never returned.
- **Results:** newest first, 20 at a time with **Show older matches**, each with the sender, time and the matched words highlighted. Choosing a result scrolls the chat to that message, loading older history as needed.
- **Limits:** 2–100 characters per search.

### Editing messages

- **Who and when:** only the sender, within 5 minutes of sending, in conversations where they can still post. Text messages and file captions can be edited; system notes, deleted messages and imported WhatsApp messages cannot. A text message cannot be edited to empty.
- **How:** **Edit** in the message menu (shown only while the 5 minutes last) puts the text back in the message box; Escape or the close button cancels.
- **What others see:** the message changes in place for everyone with an "edited" label, and the chat-list preview, reply quotes of that message and notification previews are updated too.
- **Server checks:** the time limit is checked on the server against the stored send time, so changing the device clock does not help. Late edits get `403`, someone else's message `403`, a message the user cannot see `404`.

### Read receipts and reactions

- **Read receipts:** each member's read position (the newest message they have seen) is already stored for unread counts. When it moves, the server sends `receipt:updated` to the conversation, and the sender's tick turns into a green double tick once every other member has read the message ("Read" in private chats, "Read by everyone" in groups). In groups, **Message info** on your own message lists who has read it and who has not.
- **Reactions:** 👍 ❤️ 😂 😮 🙏 🎉, from the row at the top of the message menu or by tapping an existing reaction chip. Each person can add each emoji once per message (several different ones are allowed); tapping your own reaction removes it. Chips show the count, highlight your own and list who reacted.
- **Rules:** anyone who can post in the conversation can react; read-only private chats, deleted messages and system notes cannot be reacted to. Adding a reaction is a single conditional database update, so double clicks or two tabs never store it twice. Deleting a message removes its reactions.

### Importing WhatsApp chats

Admins can bring an existing WhatsApp group's history into a program group: **Admin → Groups → (group) → Import WhatsApp chat**. To try it without a real export, use [docs/samples/whatsapp-export-sample.txt](docs/samples/whatsapp-export-sample.txt).

1. In WhatsApp, export the chat **without media**, which produces a `.txt` file (a `.zip` is refused with an explanation). Maximum 5 MB and 20,000 messages.
2. The server reads the file and shows a preview: number of messages, date range, the first few messages, lines it could not read, and whether the file or some of its messages were imported before.
3. The admin links each WhatsApp sender to a member of the group, or leaves them unlinked. Names that match a member are suggested.
4. On import, the messages are placed in the group's history at their original times, with a "WhatsApp" badge and the sender name from the export when unlinked. A system note records who imported how many messages, and members' screens reload the history (`conversation:history`). Imported messages do not raise unread counts or notifications.

Details:

- **Formats:** Android and iPhone exports, 12- and 24-hour times, messages over several lines, and the invisible characters WhatsApp inserts. Whether dates are day-first or month-first is detected from the file, and the admin can override it when every date is ambiguous (for example 05/06).
- **Time zone:** exports have no time zone, so the times are read in the uploading admin's browser time zone.
- **Skipped:** "end-to-end encrypted" and other notices, deleted messages, and lines with impossible or future dates (reported in the preview). Media placeholders become "[Photo, video or file not included in the export]". Messages longer than 4,000 characters are shortened.
- **Privacy:** senders saved in the export as a phone number are stored as "WhatsApp contact ending 3210", so full numbers never reach other users.
- **Duplicates:** importing the same file into the same group again is refused (`409`). For a newer export of the same chat, messages already imported are recognised by their time, sender and text and skipped, and the result lists how many were added and skipped.
- **Access:** admin only (`403` for others); the import history of each group is listed on the same screen.

### AI summary of open doubts

Mentors and admins open it with the ✨ **AI summary of open doubts** button in a group's header, which opens **Group info → Doubts** and starts the summary straight away (the same card has a **Summarise open doubts** button at the top of the Doubts tab). It groups the group's open (unresolved) doubts by topic and writes a short overview, so a mentor can catch up quickly; each doubt in a topic has **Go to doubt**.

- **Provider:** [Groq](https://groq.com) (default model `openai/gpt-oss-120b`), called only from the NestJS backend (`backend/src/modules/ai`) through its OpenAI-compatible chat completions API. The API key is sent in the `Authorization` header, never reaches the browser and is never logged; only response status and error codes are logged.
- **What is sent:** the group name and, for up to the 40 most recent open doubts, the asker's display name, how long ago it was asked, the text (or file name) and up to three replies with their authors' names and roles. No emails, user ids or other details are sent. Doubts from other groups are never included, and mentees cannot request a summary (`403`).
- **Clearly labelled:** the card says the summary is AI-generated and may be inaccurate, shows when it was generated and the model, and keeps every original doubt one tap away.
- **No made-up content:** the reply must match a fixed JSON schema, enforced by Groq's strict structured output; every doubt is mapped back to a real message, unknown ids are dropped, and any doubt the model left out is listed under "Not included by the AI". The prompt tells the model to use only the given messages and to treat them as data, not instructions.
- **Failures are explicit:** with no key configured the card says AI summaries are not set up (`503`); if Groq is rate-limited it asks to try again in a minute (`429`); after three attempts on Groq server errors, with an invalid key, or on an invalid reply, it says the summary could not be generated (`502`). No fallback summary is ever invented. With no open doubts, Groq is not called at all.
- **Cost control:** 6 summaries per minute per user, and the same set of doubts is answered from a 10-minute cache.

Setup: create a key in the [Groq console](https://console.groq.com/keys) and set `GROQ_API_KEY` in `backend/.env` (optionally `GROQ_MODEL`, default `openai/gpt-oss-120b`; the model must support strict JSON schema output), then restart the API. Variables already set in the operating system take precedence over `backend/.env`, so make sure no old `GROQ_API_KEY` user or system variable is set.

### Desktop notifications

- **Opt-in:** a **Desktop notifications** switch at the top of the notifications panel. The browser asks for permission only when the person switches it on; the choice is remembered in that browser.
- **When:** for the same events as the bell (replies, announcements, resolved doubts), and only while UnsaidTalks is open in a tab that is in the background, minimised or behind another window. While the person is looking at the app, the toast and bell are used instead, so the conversation they are reading never triggers one. Nothing is shown for their own actions.
- **Closed tab, no notifications:** they use the browser's Notification API from the page itself, driven by the existing `notification:new` socket event. There is no service worker, Web Push or push server, so once every UnsaidTalks tab is closed nothing is shown.
- **No duplicates:** with several tabs open, only the first tab to receive a notification shows it, and each notification is tagged with its id so the browser replaces rather than repeats it.
- **Privacy:** the notification says who did what and where ("Priya Sharma replied to your message in TCS NQT Prep") but never the message text, which could appear on a lock screen.
- **Clicking it** focuses the tab and opens the message.
- **Blocked or unsupported:** if notifications are blocked for the site, the switch is disabled with instructions; browsers that allow notifications only from a service worker, such as Chrome on Android, see a short explanation instead.

| Method           | Path                                                | Purpose                                                 |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `GET`            | `/api/conversations/:id/messages/search?q=&before=` | Search a conversation, 20 results per page              |
| `PATCH`          | `/api/messages/:id`                                 | `{ text }`: edit your own message within 5 minutes      |
| `PUT` / `DELETE` | `/api/messages/:id/reactions/:emoji`                | Add or remove your reaction                             |
| `POST`           | `/api/conversations/:id/doubts/summary`             | AI summary of the group's open doubts (mentors, admins) |
| `GET`            | `/api/admin/groups/:id/imports`                     | Imports into a group                                    |
| `POST`           | `/api/admin/groups/:id/imports/preview`             | Read a WhatsApp export without saving it                |
| `POST`           | `/api/admin/groups/:id/imports`                     | Import a WhatsApp export with the sender links          |

## Mobile and accessibility

Most students use phones, so every screen is designed for a 375 px wide phone first and checked on tablets and desktops.

- **Layout:** on phones the chat list and an open conversation are separate screens with a back button; from 768 px they sit side by side, and from 1024 px group info opens as a side panel instead of a full-screen sheet. The header shows icons only on small phones. Browser tests check that the chat and admin screens do not scroll sideways at 375 px.
- **Touch:** the send, attach, emoji, back and header buttons are 40–44 px; the message menu button is always visible on touch screens (it appears on hover with a mouse) and a long press on a message opens the same menu; Enter adds a new line on touch keyboards while the send button sends. Text fields use 16 px text so iOS does not zoom in.
- **Emoji:** the smiley button in the message box opens a WhatsApp-style emoji popup over the chat, with category tabs, search and a recently used row (remembered in that browser). Emoji go in where the cursor is, and the popup closes on a click or tap anywhere else, or with Escape. On phones the keyboard makes way while it is open.
- **Phones with notches:** the message box stays above the home indicator, and content keeps clear of the notch in landscape.
- **Keyboard and screen readers:** dialogs move focus inside, keep it there and return it when closed; menus open with focus on their first item and close with Escape; every icon-only button has a label; new messages are announced through a live region.
- **Readability:** timestamps and other secondary text were darkened to meet the WCAG AA contrast ratio (4.5:1) on the main backgrounds.
- **Reduced motion:** with the system setting on, animations are switched off and scrolling to a message jumps instead of gliding.
- **Notifications while away:** toasts are not shown while the tab is hidden, where they would expire unseen; the bell keeps the count, and desktop notifications can be switched on.

## Real-time design

### Connection

- **Socket.IO over WebSocket only.** Both the server gateway and the browser client set `transports: ['websocket']`, so there is no HTTP long-polling fallback. The client connects to the `/chat` namespace. Locally it goes through the Vite dev server, which forwards `/socket.io` to NestJS. In production it connects to the API server on Render directly (`VITE_SOCKET_URL`), because Vercel does not forward WebSockets, while REST calls still go through Vercel so the refresh cookie stays first-party.
- **Authenticated handshake.** The browser sends its in-memory access token in the Socket.IO handshake (`auth.token`). Server middleware verifies it, loads the user and places the socket in its rooms _before_ the connection is accepted, so no message can arrive between "connected" and "joined". If the token has expired, the handshake is refused; the client gets a new access token from the refresh cookie and reconnects.

### Rooms

| Room                | Who is in it                              | Used for                                                         |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `user:<userId>`     | Every open tab and device of one user     | Notifications, read-state sync, group membership changes, logout |
| `conversation:<id>` | Every connected member of a group or chat | New messages, pins, doubt changes and deletions                  |

When an admin adds someone to a group, the server moves that person's open sockets into the group's room immediately (no reconnect needed); removing someone takes them out. Deactivating an account disconnects all of its sockets. An admin viewing a group as a moderator joins its room explicitly with `conversation:open`.

### Events

| Direction       | Event                          | Payload                                                                     | Purpose                                                                                           |
| --------------- | ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Client → server | `message:send`                 | `{ conversationId, text, clientId, replyToId?, isAnnouncement?, isDoubt? }` | Send a message; the acknowledgement returns the stored message or an error                        |
| Client → server | `conversation:open`            | `{ conversationId }`                                                        | Moderator starts following a group                                                                |
| Client → server | `conversation:close`           | `{ conversationId }`                                                        | Moderator stops following                                                                         |
| Client → server | `presence:sync`                | none                                                                        | Returns which of the user's contacts are online right now                                         |
| Client → server | `typing:start` / `typing:stop` | `{ conversationId }`                                                        | The user started or stopped typing                                                                |
| Server → client | `message:new`                  | `{ message, preview, clientId? }`                                           | A message was posted (also used to update chat-list previews)                                     |
| Server → client | `message:updated`              | `{ message }`                                                               | A message was edited, reacted to, pinned or unpinned, its doubt status changed, or it was deleted |
| Server → client | `conversation:read`            | `{ conversationId }`                                                        | The user read a chat in another tab; clear its unread badge here too                              |
| Server → client | `conversation:added`           | `{ conversationId }`                                                        | The user was added to a group; refresh the chat list                                              |
| Server → client | `conversation:removed`         | `{ conversationId }`                                                        | The user was removed from a group                                                                 |
| Server → client | `conversation:unread`          | `{ conversationId, unreadCount }`                                           | An unread count changed because a message was deleted                                             |
| Server → client | `notification:new`             | `{ notification, unreadCount }`                                             | A reply, announcement or resolved doubt for this user                                             |
| Server → client | `notifications:read`           | `{ unreadCount, ids?, conversationId? }`                                    | Notifications were read in another tab (by id, by chat, or all)                                   |
| Server → client | `notifications:removed`        | `{ ids, unreadCount }`                                                      | Notifications about a deleted message were removed                                                |
| Server → client | `presence:update`              | `{ userId, online, lastSeenAt? }`                                           | A contact came online or went offline                                                             |
| Server → client | `typing`                       | `{ conversationId, userId, name, isTyping }`                                | Someone in the conversation started or stopped typing                                             |
| Server → client | `receipt:updated`              | `{ conversationId, userId, lastReadMessageId }`                             | A member read up to a message (read receipts)                                                     |
| Server → client | `conversation:history`         | `{ conversationId }`                                                        | Older history was imported into a group; reload it                                                |

### Sending a message

1. The app shows the message immediately as a draft with a clock icon and a random `clientId`.
2. It emits `message:send`. The server validates the text (1–4000 characters), checks that the sender may post in the conversation, applies a limit of 10 messages per 5 seconds per user, and stores the message.
3. In one update the server makes it the conversation's last message, adds one unread message for every other member, and marks the sender as having read up to it. Two messages sent at almost the same moment may finish in either order, so a later message (higher id) is never replaced by an earlier one, on the server or in the chat list.
4. The server broadcasts `message:new` to the conversation room and acknowledges the sender. Whichever arrives first replaces the draft (matched by `clientId`), and the clock becomes a check mark.
5. If no acknowledgement arrives within 10 seconds, the draft shows "Retry". A retry reuses the same `clientId`, and a unique index on `(senderId, clientId)` makes the server return the already-stored message instead of creating a duplicate.

### History, unread counts and reconnecting

- **History** is loaded over REST in pages of 30 (`GET /api/conversations/:id/messages`). Scrolling up requests `?before=<oldest id>`. Message ids are MongoDB ObjectIds, which increase over time, so the id works as a stable cursor even while new messages keep arriving.
- **Unread counts** are stored per member and updated in a single database operation per message. Opening a conversation calls `POST /api/conversations/:id/read`; a "New messages" divider marks where the reader stopped.
- **Reconnecting:** Socket.IO reconnects automatically while a "Reconnecting…" banner is shown, retrying at most every 5 seconds and abandoning any attempt that has not finished its handshake within 8 seconds. Once connected again, the app reloads the chat list and notifications, fetches anything it missed in the open conversation with `?after=<newest id>`, and then reloads the messages already on screen, so messages deleted, pinned or answered while the network was down are shown correctly without a page refresh. The pinned bar and any open Pinned, Doubts or Announcements list are reloaded too.

### Presence and typing

- **Online / offline:** the server counts each user's open connections. A user comes online when their first tab connects and goes offline when the last one closes; at that moment their "last seen" time is saved. A reload therefore does not flicker offline, and if the user reconnects while the offline update is being saved, the stale update is dropped.
- **Who sees it:** presence changes are sent only to the rooms of conversations the user belongs to, so only people who share a group or chat with them learn their status. `presence:sync` (called after every connect and after joining a group) returns the current online contacts.
- **Shown as:** a green dot on avatars, "online" or "last seen today at 7:42 pm" under a private chat's title, and "N online" in groups.
- **Typing:** while typing, the app sends `typing:start` at most every 3 seconds and `typing:stop` after 4 seconds of inactivity, on send, or when the box empties. The server relays it only to rooms the socket already belongs to, without touching the database. Receivers drop an indicator after 6 seconds without a refresh, so a lost "stop" can never leave "typing…" stuck. Typing signals are sent as volatile packets and are never replayed after a reconnect.

### Scaling beyond one server

Socket rooms, presence counts and the send limiter currently live in one Node process. To run several API instances behind a load balancer, add the Socket.IO Redis adapter (rooms and broadcasts then work across instances) and move presence counts and the send limiter's counters to Redis. The rest of the design (stateless JWT access tokens, events emitted after database writes) does not change.

## Repository layout

```
backend/    NestJS API and WebSocket gateway, Mongoose schemas, seed script, unit and API tests  → Render
frontend/   React 17 app, unit tests, Playwright browser tests (frontend/e2e)                     → Vercel
docs/       Architecture, database schema, assignment brief, sample WhatsApp export
```

`backend` and `frontend` are separate npm projects, each with its own `package.json`, lockfile and settings, so each can be installed, built and deployed on its own.

## Getting started

### Prerequisites

- Node.js 22 and npm 10 or newer
- A MongoDB Atlas cluster

### 1. Prepare MongoDB Atlas

1. **Database Access:** create a database user with the built-in role `readWrite` on the `unsaidtalks` database and on `unsaidtalks_test` (used by the automated tests). Avoid "Atlas admin".
2. **Network Access:** add your current IP address to the IP access list.

### 2. Configure the backend

Copy the example file and fill in the values:

```bash
cp backend/.env.example backend/.env
```

| Variable            | Description                                                                         | Default                 |
| ------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| `MONGODB_URI`       | Atlas connection string including the `unsaidtalks` database                        | required                |
| `JWT_ACCESS_SECRET` | Random secret of at least 32 characters for signing access tokens                   | required                |
| `PORT`              | API port                                                                            | `3000`                  |
| `CLIENT_ORIGIN`     | The web app's address, allowed for CORS                                             | `http://localhost:5173` |
| `NODE_ENV`          | `development`, `production` or `test`                                               | `development`           |
| `MONGODB_DB_NAME`   | Optional override of the database named in `MONGODB_URI`                            | –                       |
| `TRUST_PROXY`       | `true` behind a reverse proxy (Render, Vercel) so rate limits use each visitor's IP | `false`                 |
| `GROQ_API_KEY`      | Groq API key for AI doubt summaries; the feature is off without it                  | –                       |
| `GROQ_MODEL`        | Groq model used for summaries                                                       | `openai/gpt-oss-120b`   |

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

If the database password contains special characters, URL-encode them in the connection string (for example `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`, `%` → `%25`). An Atlas auto-generated password contains only letters and digits and needs no encoding.

`backend/.env` is git-ignored. Never commit real credentials.

### 3. Install, verify, seed and run

```bash
cd backend
npm install
npm run db:check   # verifies the connection and permissions
npm run seed       # resets and loads sample data, then runs integrity checks
npm run dev        # API on http://localhost:3000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev        # web app on http://localhost:5173
```

### Sample accounts

Created by `npm run seed` in `backend`. All accounts use the password `Demo@1234`. In development, the sign-in page also offers one-click demo accounts.

| Role   | Name           | Email              | Notes                                |
| ------ | -------------- | ------------------ | ------------------------------------ |
| Admin  | Ananya Rao     | `admin@demo.test`  |                                      |
| Mentor | Priya Sharma   | `priya@demo.test`  |                                      |
| Mentor | Arjun Mehta    | `arjun@demo.test`  |                                      |
| Mentor | Kavya Iyer     | `kavya@demo.test`  |                                      |
| Mentor | Karan Malhotra | `karan@demo.test`  | Pending approval; cannot sign in yet |
| Mentor | Divya Menon    | `divya@demo.test`  | Pending approval; cannot sign in yet |
| Mentee | Rahul Verma    | `rahul@demo.test`  |                                      |
| Mentee | Sneha Patel    | `sneha@demo.test`  |                                      |
| Mentee | Aman Gupta     | `aman@demo.test`   |                                      |
| Mentee | Ishita Singh   | `ishita@demo.test` |                                      |
| Mentee | Rohan Das      | `rohan@demo.test`  |                                      |
| Mentee | Meera Nair     | `meera@demo.test`  |                                      |
| Mentee | Vikram Joshi   | `vikram@demo.test` |                                      |
| Mentee | Neha Kulkarni  | `neha@demo.test`   |                                      |

The seed also creates three program groups, three one-to-one chats, announcements, pinned messages, open and resolved doubts, replies, a shared PDF, an image posted as a doubt, a deleted message, reactions, notifications and two open reports. The sample files live in `backend/src/database/seed/assets`.

## Testing

| Folder     | Command            | What it runs                                                                                                                                                                                                                       |
| ---------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`  | `npm test`         | Unit tests (Jest)                                                                                                                                                                                                                  |
| `backend`  | `npm run test:e2e` | API and Socket.IO tests against the real app and the `unsaidtalks_test` database                                                                                                                                                   |
| `frontend` | `npm test`         | Unit tests (Vitest)                                                                                                                                                                                                                |
| `frontend` | `npm run test:e2e` | Browser tests (desktop Chrome and a Pixel 7 screen). They start their own API and web servers on ports 3100 and 5174 and use the same split as production: HTTP through the web server's proxy, the WebSocket straight to the API. |

The API and browser tests never use the development database: they set `MONGODB_DB_NAME=unsaidtalks_test`, and the API tests refuse to start against any database whose name does not end in `_test`. The browser tests need the backend installed and `backend/.env` in place. Before the first browser test run, install the browser once with `npx playwright install chromium` in `frontend`.

## Scripts

| Folder     | Command            | Description                                      |
| ---------- | ------------------ | ------------------------------------------------ |
| `backend`  | `npm run dev`      | Start the API in watch mode                      |
| `backend`  | `npm run build`    | Compile to `dist/`                               |
| `backend`  | `npm start`        | Run the compiled API (used by Render)            |
| `backend`  | `npm run db:check` | Check the MongoDB connection and permissions     |
| `backend`  | `npm run seed`     | Reset the database with sample data              |
| `frontend` | `npm run dev`      | Start the web app with the API proxy             |
| `frontend` | `npm run build`    | Type-check and build to `dist/` (used by Vercel) |
| `frontend` | `npm run preview`  | Serve the production build locally               |
| both       | `npm run lint`     | ESLint                                           |
| both       | `npm run format`   | Prettier (settings in each `package.json`)       |

## Deploying (Render + Vercel)

The backend runs on Render and the frontend on Vercel. Vercel serves the app and forwards every `/api` request to Render, so the browser sees one site and the `SameSite=Strict` refresh cookie keeps working. The WebSocket connects to Render directly. The [architecture document](docs/ARCHITECTURE.md#system-overview) shows the full picture.

### 1. MongoDB Atlas

- **Network Access:** Render's free instances have no fixed outgoing IP address, so allow access from anywhere (`0.0.0.0/0`). Keep the database user's password strong and its role limited to `readWrite` on `unsaidtalks`. (Paid Render plans can use fixed outgoing IP addresses instead.)
- **Data:** if the database is empty, seed it once from your computer with `npm run seed` in `backend`. Seeding resets all data.

### 2. Backend on Render

Create a **Web Service** from the GitHub repository:

| Setting           | Value                                   |
| ----------------- | --------------------------------------- |
| Name              | `unsaidtalks-api`                       |
| Root Directory    | `backend`                               |
| Runtime           | Node                                    |
| Build Command     | `npm ci --include=dev && npm run build` |
| Start Command     | `npm start`                             |
| Health Check Path | `/api/health`                           |

Environment variables:

| Variable            | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                                          |
| `MONGODB_URI`       | Your Atlas connection string                                                          |
| `JWT_ACCESS_SECRET` | A new random secret (do not reuse the development one)                                |
| `CLIENT_ORIGIN`     | Your Vercel address, for example `https://unsaidtalks.vercel.app` (no trailing slash) |
| `TRUST_PROXY`       | `true`                                                                                |
| `GROQ_API_KEY`      | Optional, for AI doubt summaries                                                      |

- `--include=dev` is needed because the Nest CLI and TypeScript, used by the build, are dev dependencies.
- Render sets `PORT` itself, and picks Node 22 from `engines` in `package.json`.
- With the name `unsaidtalks-api` the service gets `https://unsaidtalks-api.onrender.com`. That address is used in `frontend/vercel.json` and for `VITE_SOCKET_URL` below; if Render gives your service a different address, use yours in both places.

### 3. Frontend on Vercel

Import the same repository as a new project:

| Setting                   | Value                                                      |
| ------------------------- | ---------------------------------------------------------- |
| Root Directory            | `frontend`                                                 |
| Framework Preset          | Vite (detected automatically)                              |
| Build and Output Settings | Defaults (`npm run build`, output `dist`)                  |
| Environment variable      | `VITE_SOCKET_URL` = `https://unsaidtalks-api.onrender.com` |

`frontend/vercel.json` forwards `/api/*` to Render, serves `index.html` for every other path (so links such as `/chats/…` work after a reload) and turns off CDN caching for API responses.

### 4. Check the deployment

1. Set `CLIENT_ORIGIN` on Render to the final Vercel address (Render redeploys when variables change).
2. Open `https://unsaidtalks-api.onrender.com/api/health`; it should show `{"status":"ok","database":"up"}`.
3. Open the Vercel address, sign in as `priya@demo.test` in one browser and `rahul@demo.test` in another, and chat.

Notes:

- **Cold starts:** Render's free instances sleep after about 15 minutes without traffic. The first request then takes up to a minute while the server starts; Vercel waits up to 120 seconds, and the app shows "Reconnecting…" and catches up once the server is up.
- **Rate limits behind proxies:** with `TRUST_PROXY=true` the API takes the visitor's IP from `X-Forwarded-For`, which Vercel always sets itself. Requests sent straight to the Render address can set that header themselves; to close that gap, have Vercel add a secret header and reject requests without it on the API.
- **Demo sign-in buttons** are only shown in development; the deployed app uses the [sample accounts](#sample-accounts) above.
