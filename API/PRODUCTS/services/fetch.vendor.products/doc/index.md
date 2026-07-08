# Fetch Vendor Products — Service Documentation

## Overview

Returns all products belonging to the authenticated vendor, including drafts and archived products when requested by status filter.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/products/vendor/mine` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Products — Vendor |

## Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | `number` | ❌ | Pagination page. Default `1` |
| `limit` | `number` | ❌ | Page size. Default `20`, max `100` |
| `search` | `string` | ❌ | Text search across vendor product fields |
| `category` | `string` | ❌ | Filter by category |
| `subcategory` | `string` | ❌ | Filter by subcategory |
| `status` | `string` | ❌ | `draft`, `active`, or `archived` |

## Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Products fetched successfully.",
  "data": {
    "products": []
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
