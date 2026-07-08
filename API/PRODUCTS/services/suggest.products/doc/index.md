# Suggest Products — Service Documentation

## Overview

Provides autocomplete-ready product suggestions for search bars. Suggestions are limited to active products and include promo-aware pricing with `originalPrice`, `discountedPrice`, and the currently active promo when one exists.

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/products/search/suggest` |
| Auth Required | No |
| Tags | Products |

## Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | `string` | ✅ | User input for autocomplete |
| `limit` | `number` | ❌ | Max suggestions. Default `8`, max `10` |

## Response Shape

Each suggestion returns:

| Field | Description |
|---|---|
| `label` | Product display name |
| `slug` | Product slug for direct navigation |
| `imageUrl` | Primary image or 3D poster preview |
| `pricing.originalPrice` | Base product price |
| `pricing.discountedPrice` | Active promo-adjusted price if any |
| `pricing.activePromo` | Best currently active promo |

## Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Product suggestions fetched successfully.",
  "data": {
    "query": "snea",
    "suggestions": []
  }
}
```

## Error Responses

| Status | Reason |
|---|---|
| `400` | Invalid query parameters |
| `500` | Database read failure |
