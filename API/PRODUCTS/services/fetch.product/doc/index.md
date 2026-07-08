# Fetch Product — Service Documentation

## Overview

Returns a single published product by MongoDB id or slug. The response includes the full product document, including pricing promos and 3D media metadata.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/products/:identifier` |
| Auth Required | No |
| Tags | Products |

## Path Parameters

| Param | Type | Description |
|---|---|---|
| `identifier` | `string` | Product MongoDB id or product slug |

## Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Product fetched successfully.",
  "data": {
    "product": {}
  }
}
```

## Error Responses

| Status | Reason |
|---|---|
| `404` | Product not found or not active |
| `500` | Database read failure |
