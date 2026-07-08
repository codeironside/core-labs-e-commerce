# Fetch Livestream — Service Documentation

## Overview

Returns a single vendor-owned livestream session, including the stored Cloudflare input identifiers and playback or ingest metadata.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/livestreams/vendor/:livestreamId` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Livestreams — Vendor |

## Path Parameters

| Param | Type | Description |
|---|---|---|
| `livestreamId` | `string` | MongoDB id of the livestream session |

## Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Livestream fetched successfully.",
  "data": {
    "livestream": {}
  }
}
```

## Error Responses

| Status | Reason |
|---|---|
| `401` | No active session |
| `403` | Authenticated user is not a vendor |
| `404` | Livestream not found |
| `500` | Database read failure |
