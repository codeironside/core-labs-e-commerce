# Fetch Vendor Livestreams — Service Documentation

## Overview

Returns all livestream sessions created by the authenticated vendor, with optional filtering by linked product.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/livestreams/vendor/mine` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Livestreams — Vendor |

## Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | `number` | ❌ | Pagination page. Default `1` |
| `limit` | `number` | ❌ | Page size. Default `20`, max `100` |
| `productId` | `string` | ❌ | Filter streams linked to a product |

## Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Livestreams fetched successfully.",
  "data": {
    "livestreams": []
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1
  }
}
```

## Error Responses

| Status | Reason |
|---|---|
| `400` | Invalid query parameters |
| `401` | No active session |
| `403` | Authenticated user is not a vendor |
| `500` | Database read failure |
