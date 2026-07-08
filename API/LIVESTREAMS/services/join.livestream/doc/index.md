# Join Livestream — Service Documentation

## Overview

Registers the authenticated viewer as a participant in the livestream. Users, vendors, and admins can join and interact with the stream in real time. After joining, clients can subscribe to the SSE feed and send chat messages.

## Endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/livestreams/:livestreamId/join` |
| Auth Required | ✅ |
| Tags | Livestreams |

## Related Realtime Endpoints

| Action | Endpoint |
|---|---|
| Subscribe to realtime updates | `GET /api/v1/livestreams/:livestreamId/events` |
| Post live chat | `POST /api/v1/livestreams/:livestreamId/comments` |
