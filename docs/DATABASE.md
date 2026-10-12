# Database schema

The app uses **MongoDB Atlas** with **Mongoose**. Each schema sits next to the code that uses it, in `backend/src/modules/*/schemas`. Why MongoDB was chosen is in the [README](../README.md#why-mongodb).

## Diagram

```mermaid
erDiagram
  users ||--o{ memberships : "is a member through"
  conversations ||--o{ memberships : "has"
  conversations ||--o{ messages : "contains"
  users ||--o{ messages : "sends"
  messages |o--o| attachments_files : "attachment.fileId"
  users ||--o{ refreshtokens : "has sessions"
  users ||--o{ notifications : "receives"
  messages ||--o{ notifications : "is the subject of"
  messages ||--o{ reports : "is reported in"
  users ||--o{ reports : "files"
  conversations ||--o{ chatimports : "receives"
  chatimports ||--o{ messages : "import.batchId"

  users {
    ObjectId _id PK
    string name
    string email UK "login only, never shown to other users"
    string passwordHash "bcrypt, never selected by default"
    string role "admin, mentor or mentee"
    string status "active, pending_approval, rejected, deactivated"
    Date lastSeenAt
  }
  conversations {
    ObjectId _id PK
    string type "group or direct"
    string name "groups"
    string program "groups"
    string batch "groups"
    bool allowMenteeDirectChat "groups"
    ObjectId_array participantIds "direct chats, exactly two"
    string directKey UK "direct chats: sorted pair of user ids"
    object lastMessage "embedded preview for the chat list"
    Date lastActivityAt
  }
  memberships {
    ObjectId _id PK
    ObjectId conversationId FK
    ObjectId userId FK
    int unreadCount
    ObjectId lastReadMessageId "read position, also used for receipts"
    ObjectId addedBy FK
  }
  messages {
    ObjectId _id PK "also the timeline order"
    ObjectId conversationId FK
    ObjectId senderId FK "null for system notes and unlinked imports"
    string type "text, image, file or system"
    string text "up to 4000 characters"
    object attachment "fileId, name, mimeType, size, width, height"
    object replyTo "snapshot of the quoted message"
    bool isAnnouncement
    object pin "pinnedBy, pinnedAt"
    object doubt "status, markedAt, resolvedBy, resolvedAt"
    object_array reactions "userId, emoji"
    Date editedAt
    Date deletedAt "soft delete"
    object import "source, senderName, batchId, fingerprint"
    string clientId "sender's id for safe retries"
  }
  attachments_files {
    ObjectId _id PK
    string filename
    int length
    object metadata "mimeType, conversationId, uploadedBy"
  }
  refreshtokens {
    ObjectId _id PK
    ObjectId userId FK
    string tokenHash UK "SHA-256, never the token itself"
    Date expiresAt "TTL index deletes expired rows"
    Date rotatedAt
    Date revokedAt
  }
  notifications {
    ObjectId _id PK
    ObjectId userId FK "recipient"
    string type "reply, announcement, doubt_resolved"
    ObjectId conversationId FK
    ObjectId messageId FK
    ObjectId actorId FK
    string preview
    Date readAt
  }
  reports {
    ObjectId _id PK
    ObjectId messageId FK
    ObjectId conversationId FK
    ObjectId reportedBy FK
    string reason "spam, abuse, personal_info, other"
    string note
    object messageSnapshot "copy taken when reported"
    string status "open, dismissed, actioned"
    ObjectId reviewedBy FK
    Date reviewedAt
  }
  chatimports {
    ObjectId _id PK
    ObjectId conversationId FK
    ObjectId importedBy FK
    string fileName
    string fileHash "SHA-256 of the export"
    int importedCount
    int skippedCount
    Date firstMessageAt
    Date lastMessageAt
  }
```

`PK` = primary key, `FK` = id of a document in another collection, `UK` = unique. Every collection also has `createdAt` and `updatedAt` times.

## Collections

| Collection             | What it stores                                                                                                                        | Main indexes                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `users`                | Accounts for all three roles. New mentors start as `pending_approval`; only `active` accounts can sign in                             | `email` (unique)                                                                            |
| `conversations`        | Groups and private chats in one collection (`type`). `lastMessage` is a small copy, so the chat list needs no extra query             | `directKey` (unique): only one private chat per pair of people                              |
| `memberships`          | One row per person per chat: their `unreadCount` and read position (`lastReadMessageId`, also used for read ticks)                    | `conversationId + userId` (unique), `userId`                                                |
| `messages`             | Every message. Reply quote, pin, doubt and reactions are stored inside the message. Deleting keeps the message but clears its content | `conversationId + _id` (history pages), `senderId + clientId` (unique), text index (search) |
| `attachments` (GridFS) | The image and PDF files, split into chunks                                                                                            | –                                                                                           |
| `notifications`        | Reply, announcement and "doubt resolved" alerts                                                                                       | `userId + _id`, `userId + readAt`                                                           |
| `reports`              | Reported messages, with a copy of the message taken at that moment                                                                    | `messageId + reportedBy` (unique): one report per person                                    |
| `refreshtokens`        | Login sessions. Only a hash of each token is stored, and expired ones are deleted automatically                                       | `tokenHash` (unique), `expiresAt` (auto-delete)                                             |
| `chatimports`          | WhatsApp chats imported into a group                                                                                                  | `conversationId + fileHash` (unique): the same file can't be imported twice                 |

## How the main screens are served

- **Chat list:** the person's memberships (`userId` index), then their conversations with the embedded `lastMessage`.
- **Loading older messages:** 30 messages of one chat before a given id (`conversationId + _id` index). Message ids grow over time, so the id is also the time order.
- **Sending a message:** one insert, plus one update that sets the last message and raises everyone else's unread count.
- **Pinned messages, doubts and announcements:** small indexes that contain only those messages.

## Keeping the data correct

MongoDB has no foreign keys, so the data is kept correct in three ways:

1. **Unique indexes** for every "only one" rule: one account per email, one membership per person per chat, one private chat per pair, no duplicate message when a send is retried.
2. **Mongoose schemas** check types, allowed values (roles, statuses) and lengths.
3. **The services** check the rules before saving, for example that a reply quotes a message from the same chat.

`npm run seed` in `backend` fills the `unsaidtalks` database with sample data (it refuses to run when `NODE_ENV=production`).
