# Update Product — Service Documentation

## Overview

Updates a vendor-owned product and protects the write with optimistic locking so stale editors cannot overwrite newer product changes.

## Endpoint

| Property | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/products/vendor/:productId` |
| Content-Type | `application/json` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Products — Vendor |

## Request

Send a JSON patch payload after any new media has already been uploaded through the dedicated vendor media upload endpoint. A product must always keep at least one image, although multiple images can be attached.

## Update JSON Shape

```json
{
  "version": 2,
  "pricing": {
    "currency": "NGN",
    "amount": 47000,
    "cost": 30000,
    "promos": [
      {
        "title": "Flash Sale",
        "type": "fixed",
        "value": 2500,
        "startsAt": "2026-04-12T08:00:00.000Z",
        "active": true,
        "code": "FLASH2500"
      }
    ]
  },
  "appendMediaAssetIds": ["67f6e055a7125d4ab7c0af45"],
  "primaryMediaAssetId": "67f6e055a7125d4ab7c0af45",
  "removeMediaPublicIds": ["flamigo/products/vendor-a/old-model"],
  "primaryMediaPublicId": "flamigo/products/vendor-a/hero-image"
}
```

## Race Locking

The service matches the update using:

```text
{ _id: productId, vendorId, version }
```

If another request increments the product first, the current update fails with `409 Conflict` and the client must refetch the latest product.

## Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Product updated successfully.",
  "data": {
    "product": {
      "_id": "67f6e0b5a7125d4ab7c0af91",
      "name": "Premium Sneaker",
      "media": [
        {
          "assetId": "67f6e099a7125d4ab7c0af90",
          "kind": "image",
          "url": "https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/new-hero.jpg",
          "thumbnailUrl": "https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/new-hero.jpg",
          "publicId": "flamigo/products/vendor-a/new-hero",
          "mimeType": "image/jpeg",
          "format": "jpg",
          "sizeBytes": 198762,
          "originalName": "new-hero.jpg",
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
      ],
      "version": 3
    }
  }
}
```

## Error Responses

| Status | Reason |
| --- | --- |
| `400` | Validation failed or malformed JSON |
| `401` | No active session |
| `403` | Authenticated user is not a vendor |
| `404` | Product not found or not owned by the vendor |
| `409` | Product version conflict due to concurrent update |
| `500` | Upload or database failure |
