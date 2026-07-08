# Upload Product Media Assets — Service Documentation

## Overview

Uploads vendor-owned product media before product creation or product updates. This endpoint stores files in Cloudinary, generates display-friendly thumbnail URLs, and returns asset ids that can later be referenced from product create or update requests. At least one image is required for each product, while multiple images are supported.

## Endpoint

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/products/vendor/media-assets` |
| Content-Type | `multipart/form-data` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Products — Vendor |

## Request

Multipart fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `images` | `File[]` | ✅ | At least one standard product image is required. Multiple images can be uploaded for one product. |
| `threeDAssets` | `File[]` | ❌ | 3D model files such as `glb`, `gltf`, `usdz`, `obj`, `fbx`, and `stl`. |
| `threeDPosterImages` | `File[]` | ❌ | Optional poster images mapped by index to the uploaded `threeDAssets`. |

`images` must contain at least one file. You can upload more than one image for the same product.

## Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Product media assets uploaded successfully.",
  "data": {
    "assets": [
      {
        "_id": "67f6e044a7125d4ab7c0af44",
        "vendorId": "67f6df0aa7125d4ab7c0af10",
        "kind": "image",
        "url": "https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/hero.jpg",
        "thumbnailUrl": "https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/hero.jpg",
        "publicId": "flamigo/products/vendor-a/hero",
        "mimeType": "image/jpeg",
        "format": "jpg",
        "sizeBytes": 248132,
        "originalName": "hero.jpg",
        "status": "ready"
      }
    ]
  }
}
```

## Error Responses

| Status | Reason |
| --- | --- |
| `400` | Missing required image upload, unsupported media file, or invalid poster/image pairing |
| `401` | No active session |
| `403` | Authenticated user is not a vendor |
| `500` | Cloudinary or database failure |
