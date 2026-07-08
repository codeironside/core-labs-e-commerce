# Create Livestream — Service Documentation

## Overview

Creates a vendor livestream session backed by Cloudflare Stream Live Inputs. The service stores the returned ingest credentials so vendors can broadcast using RTMPS, SRT, or WebRTC where Cloudflare makes them available.

## Endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/livestreams/vendor` |
| Content-Type | `application/json` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Livestreams — Vendor |

## Request Body

```json
{
  "title": "Friday Product Drop Live",
  "description": "Live walkthrough of new arrivals.",
  "productId": "661f2f218f2c97f1f8a0ab12",
  "enabled": true,
  "preferLowLatency": true,
  "recording": {
    "mode": "automatic",
    "requireSignedURLs": false,
    "allowedOrigins": ["shop.example.com"],
    "hideLiveViewerCount": false,
    "timeoutSeconds": 0,
    "deleteRecordingAfterDays": 45
  }
}
```

## Cloudflare Notes

| Setting | Behavior |
|---|---|
| `preferLowLatency` | Requires `recording.mode = automatic` |
| `deleteRecordingAfterDays` | Must be between `30` and `1096` |
| `productId` | Optional, but must belong to the authenticated vendor if provided |

## Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Livestream created successfully.",
  "data": {
    "livestream": {}
  }
}
```

## Error Responses

| Status | Reason |
|---|---|
| `400` | Validation failed |
| `401` | No active session |
| `403` | Authenticated user is not a vendor |
| `404` | Linked product not found for the vendor |
| `500` | Cloudflare config missing or provider request failed |
