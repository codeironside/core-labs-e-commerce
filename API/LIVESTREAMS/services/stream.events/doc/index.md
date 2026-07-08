# Stream Livestream Events — Service Documentation

## Overview

Streams realtime livestream activity over SSE using Redis pub/sub. The live video itself is served in real time / low latency by Cloudflare Stream, while app interaction is broadcast here. Clients receive viewer presence, comments, bids, auction lifecycle updates, and Cloudflare status sync events on one stream.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/livestreams/:livestreamId/events` |
| Auth Required | ✅ |
| Tags | Livestreams |

## Related Realtime Endpoints

| Action | Endpoint |
|---|---|
| Join livestream | `POST /api/v1/livestreams/:livestreamId/join` |
| Post live chat | `POST /api/v1/livestreams/:livestreamId/comments` |
| Fetch chat history | `GET /api/v1/livestreams/:livestreamId/comments` |
