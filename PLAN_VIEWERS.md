# Viewer Count Feature Plan

## Overview
Track active viewers for broadcasts and display count in DJ app.

## Database Schema

### New table: `live_stats`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| channel_id | bigint | FK to channels table |
| viewer_id | string | Unique identifier for viewer (session/fingerprint) |
| last_seen_at | timestamp | Last ping time |
| created_at | timestamp | First connection time |

**Indexes:**
- `channel_id` + `viewer_id` (unique)
- `last_seen_at` (for cleanup queries)

## API Endpoints

### 1. POST `/api/channel/watch/{hash}/ping`
- Called by viewer every 30 seconds
- Creates or updates `live_stats` record
- Request: `{ viewer_id: string }`
- Response: `{ success: true }`

### 2. DELETE `/api/channel/watch/{hash}/leave`
- Called when viewer leaves (beforeunload event)
- Removes viewer's `live_stats` record
- Request: `{ viewer_id: string }`

### 3. GET `/api/channel/{userId}/viewers`
- Returns count of active viewers (last_seen_at within 5 minutes)
- Response: `{ count: number }`

### 4. Existing: GET `/api/channel/watch/{hash}`
- Add `viewer_count` to response

## Cleanup Strategy

1. **On every ping**: Delete records older than 5 minutes for that channel
2. **Scheduled job** (optional): Clean all stale records periodically

## Frontend Changes

### BroadcastViewer.jsx
- Generate unique viewer_id on mount (use localStorage or generate UUID)
- Ping every 30 seconds while watching
- Call leave endpoint on unmount/beforeunload

### ChannelSection.jsx (DJ App)
- Show "Viewers: X" instead of "Code: 1234"
- Poll viewer count every 10 seconds while broadcasting

## Implementation Order

1. Create migration for `live_stats` table
2. Create LiveStat model
3. Add ping/leave endpoints to ChannelController
4. Add viewer_count to getChannelState response
5. Update BroadcastViewer to ping/leave
6. Update ChannelSection to show viewer count
