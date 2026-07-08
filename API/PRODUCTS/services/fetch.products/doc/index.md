# Fetch Products — Service Documentation

## Overview

Returns publicly visible products. Only `active` products are returned, including pricing, promo metadata, and media records for standard images or 3D assets.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/products` |
| Auth Required | No |
| Tags | Products |

## Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | `number` | ❌ | Pagination page. Default `1` |
| `limit` | `number` | ❌ | Page size. Default `20`, max `100` |
| `search` | `string` | ❌ | Text search across indexed product fields |
| `category` | `string` | ❌ | Filter by category |
| `subcategory` | `string` | ❌ | Filter by subcategory |
| `vendorId` | `string` | ❌ | Filter by vendor |

## Response Shape

Each returned product includes:

| Field Group | Notes |
|---|---|
| `characteristics` | Rich product specs for display and filtering |
| `pricing` | Base amount, compare-at price, cost, and `promos[]` |
| `media` | Image and 3D asset metadata |
| `version` | Current optimistic-lock version |

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
| `500` | Database read failure |
