# Create Comment — Service Documentation

## Overview

Creates a livestream comment and broadcasts it in realtime to SSE subscribers. This is the live chat endpoint for the real-time livestream experience.

## Endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/livestreams/:livestreamId/comments` |
| Auth Required | ✅ |
| Tags | Livestreams |

## Related Realtime Endpoints

| Action | Endpoint |
|---|---|
| Join livestream | `POST /api/v1/livestreams/:livestreamId/join` |
| Subscribe to realtime updates | `GET /api/v1/livestreams/:livestreamId/events` |
