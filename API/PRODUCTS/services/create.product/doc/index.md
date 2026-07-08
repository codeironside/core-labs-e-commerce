# Create Product — Service Documentation

## Overview

Allows an authenticated vendor to create a product with rich characteristics, pricing, promo campaigns, media uploads, and optional 3D assets.

## Endpoint

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/products/vendor` |
| Content-Type | `application/json` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Products — Vendor |

## Request

Send a JSON payload after media has already been uploaded through the dedicated vendor media upload endpoint. The referenced `mediaAssetIds` must include at least one uploaded image asset. Multiple image assets can be attached to the same product.

## Product JSON Shape

```json
{
  "name": "Premium Sneaker",
  "description": "Lightweight sneaker with breathable mesh upper.",
  "category": "Footwear",
  "characteristics": [
    { "name": "Color", "value": "Black", "highlighted": true },
    { "name": "Material", "value": "Mesh" }
  ],
  "pricing": {
    "currency": "NGN",
    "amount": 45000,
    "compareAtAmount": 50000,
    "cost": 30000,
    "taxInclusive": false,
    "promos": [
      {
        "title": "Launch Discount",
        "type": "percentage",
        "value": 10,
        "startsAt": "2026-04-10T00:00:00.000Z",
        "endsAt": "2026-04-30T23:59:59.000Z",
        "active": true
      }
    ]
  },
  "inventory": {
    "quantity": 15,
    "lowStockThreshold": 3,
    "allowBackorder": false
  },
  "mediaAssetIds": [
    "67f6e044a7125d4ab7c0af44",
    "67f6e055a7125d4ab7c0af45"
  ],
  "primaryMediaAssetId": "67f6e044a7125d4ab7c0af44",
  "status": "draft"
}
```

## Promo Rules

| Field | Rule |
| --- | --- |
| `type` | `percentage` or `fixed` |
| `value` | Must be positive |
| `percentage` promos | Cannot exceed `100` |
| `endsAt` | Must be later than `startsAt` |
| `code` | Optional promo code, normalized to uppercase |

## Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Product created successfully.",
  "data": {
    "product": {
      "_id": "67f6e0b5a7125d4ab7c0af91",
      "name": "Premium Sneaker",
      "slug": "premium-sneaker",
      "media": [
        {
          "assetId": "67f6e044a7125d4ab7c0af44",
          "kind": "image",
          "url": "https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/hero.jpg",
          "thumbnailUrl": "https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/hero.jpg",
          "publicId": "flamigo/products/vendor-a/hero",
          "mimeType": "image/jpeg",
          "format": "jpg",
          "sizeBytes": 248132,
          "originalName": "hero.jpg",
          "sortOrder": 0,
          "isPrimary": true
        },
        {
          "assetId": "67f6e055a7125d4ab7c0af45",
          "kind": "model_3d",
          "url": "https://res.cloudinary.com/flamigo/raw/upload/v1/flamigo/products/vendor-a/chair.glb",
          "thumbnailUrl": "https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/chair-preview.jpg",
          "publicId": "flamigo/products/vendor-a/chair",
          "mimeType": "model/gltf-binary",
          "format": "glb",
          "sizeBytes": 1932812,
          "originalName": "chair.glb",
          "sortOrder": 1,
          "isPrimary": false,
          "posterUrl": "https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/chair-preview.jpg",
          "posterPublicId": "flamigo/products/vendor-a/chair-preview"
        }
      ]
    }
  }
}
```

## Error Responses

| Status | Reason |
| --- | --- |
| `400` | Invalid JSON payload, schema validation failure, or unsupported media file |
| `401` | No active session |
| `403` | Authenticated user is not a vendor |
| `500` | Cloudinary or MongoDB failure |
