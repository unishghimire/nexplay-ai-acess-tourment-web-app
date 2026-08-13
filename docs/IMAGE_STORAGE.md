# NexPlay Image Storage — ImgBB Integration

## Architecture

NexPlay uses **ImgBB** as its primary image hosting provider, with **Cloudinary** and **Firebase Storage** as fallbacks for continuity with existing data.

### Upload Flow

```
USER SELECTS IMAGE
    ↓
CLIENT VALIDATION (mediaService.validateImage — MIME, size, category-specific limits)
    ↓
IMAGE PREVIEW (local FileReader/base64 while uploading)
    ↓
UPLOAD REQUEST (mediaService.uploadImage → POST /api/upload/image)
    ↓
SERVER (Express on Vercel — api/index.ts → server/routes/media.ts)
    ↓
IMGBB API (POST https://api.imgbb.com/1/upload with base64 + API key)
    ↓
VERIFY IMGBB RESPONSE (check json.success === true)
    ↓
GET IMAGE URL + THUMBNAIL + MEDIUM + DELETE_URL
    ↓
SAVE METADATA TO FIRESTORE (media collection)
    ↓
RETURN SUCCESS { url, public_id, media }
    ↓
UPDATE UI (onUploadSuccess callback)
```

If ImgBB fails, the server falls back to Cloudinary, then Firebase Storage. The response format is normalized across all providers.

### Single Upload Path

All image uploads go through `src/shared/services/mediaService.ts`:

- `uploadImage(file, category, onProgress?)` — upload a new image
- `replaceImage(oldMediaId, oldPublicId, newFile, category, onProgress?)` — replace (upload new first, delete old after success)
- `deleteImage(mediaId, publicId)` — delete (removes Firestore reference + tries provider deletion)
- `validateImage(file, category?)` — client-side validation
- `getDisplayUrl(url, size, thumbUrl?, mediumUrl?)` — get appropriately sized URL

The `useInvisibleImage` hook (paste/drop/file-select) also routes through `mediaService.uploadImage()` — there is only one upload path.

## Environment Variable

```
IMGBB_API_KEY=your_api_key_here
```

Get your API key at https://api.imgbb.com/

The key is only used server-side in `server/shared.ts` — never exposed to the client.

Added to `.env.example` for reference. Set in Vercel project settings (Production + Preview environments).

## Firestore Metadata

Images are cataloged in the `media` Firestore collection:

```json
{
  "id": "auto-generated-doc-id",
  "userId": "firebase-auth-uid",
  "url": "https://i.ibb.co/xxx/full-size.jpg",
  "publicId": "https://imgbb.com/delete/xxx...  (delete_url for ImgBB)",
  "thumbUrl": "https://i.ibb.co/xxx/thumb.jpg",
  "mediumUrl": "https://i.ibb.co/xxx/medium.jpg",
  "provider": "imgbb",
  "fileName": "original-filename",
  "fileSize": 123456,
  "mimeType": "image/jpeg",
  "category": "USER_AVATAR",
  "createdAt": "Firestore timestamp"
}
```

**Note:** `publicId` stores the ImgBB `delete_url` (a one-time-use URL). Existing Cloudinary records retain their Cloudinary `public_id`.

## Supported Image Types

| Format | Allowed |
|--------|---------|
| JPEG   | ✅ |
| PNG    | ✅ |
| WEBP   | ✅ |
| GIF    | ✅ |

## Size Limits (per category)

| Category | Max Size |
|----------|----------|
| USER_AVATAR | 5MB |
| TEAM_LOGO | 5MB |
| TEAM_BANNER | 10MB |
| ORG_LOGO | 5MB |
| ORG_BANNER | 10MB |
| TOURNAMENT_BANNER | 10MB |
| TOURNAMENT_THUMBNAIL | 5MB |
| SCRIM_BANNER | 10MB |
| NEWS_IMAGE | 10MB |
| PRODUCT_IMAGE | 5MB |
| SPONSOR_LOGO | 5MB |
| OVERLAY_GRAPHIC | 10MB |
| OTHER | 10MB |

## Authorization

| Role | Can upload |
|------|-----------|
| Player | Own profile avatar |
| Team leader | Team logo (per existing team rules) |
| Organizer | Tournament images for their tournaments |
| Admin | Game images, news images, slides, all admin images |

**Server-side enforcement:** All upload endpoints require `authenticateToken` middleware (Firebase ID token verification). The `/api/media/delete` endpoint checks ownership — admins can delete any media; others can only delete their own.

## ImgBB Upload Points in NexPlay

| Feature | Upload method | Category |
|---------|--------------|----------|
| Profile avatar | `useInvisibleImage` hook | `USER_AVATAR` |
| Team logo (create) | `useInvisibleImage` hook | `TEAM_LOGO` |
| Team logo (update) | `useInvisibleImage` hook | `TEAM_LOGO` |
| Team banner | `useInvisibleImage` hook | `TEAM_BANNER` |
| Tournament banner | `ImageUploader` component | `TOURNAMENT_BANNER` |
| News image | `useInvisibleImage` hook | `NEWS_IMAGE` |
| Game image (admin) | `useInvisibleImage` hook | `OTHER` |
| Slide image (admin) | `useInvisibleImage` hook | `OVERLAY_GRAPHIC` |
| Payment QR (admin) | `useInvisibleImage` hook | `OTHER` |
| Result upload | `useInvisibleImage` hook | `OTHER` |
| Media library (admin) | `ImageUploader` component | per-selected category |

## Replace Image

1. Upload new image via `mediaService.uploadImage()`
2. If upload succeeds → delete old image in background (`deleteImage()`)
3. If upload fails → old image is preserved (never destroyed before new is confirmed)

## Delete Limitations

**ImgBB does NOT support deletion by public ID.** Deletion is only possible via the `delete_url` returned at upload time.

- The `delete_url` is stored as `publicId` in Firestore for ImgBB uploads.
- `deleteImage()` calls the server endpoint which tries the `delete_url`.
- If the `delete_url` has expired or is invalid, only the Firestore reference is removed — the physical file on ImgBB may persist.
- This is a known ImgBB API limitation. We do not fake deletion success.

## Error Handling

All errors are surfaced to the user via toast notifications and the `ImageUploader` error banner.

Handled errors:
- Invalid file type/extension
- File too large (per-category limit)
- Network failure
- ImgBB API failure (non-200 response)
- Invalid API key (server-side, returns 500)
- Firestore write failure (warned, upload still succeeds)
- Unauthorized (no auth token)
- Double-click protection (loading state disables upload button)

## Performance

ImgBB returns multiple image sizes at upload time:
- `url` — full-size image (use for detail pages, banners)
- `mediumUrl` — medium-size (use for card views)
- `thumbUrl` — thumbnail (use for avatars, small previews)

Use `mediaService.getDisplayUrl(url, size, thumbUrl, mediumUrl)` to get the appropriate size.

For existing Cloudinary URLs, `mediaService.generateOptimizedUrl()` provides on-the-fly transforms via URL modification.

## Migration Status

| Provider | Status |
|----------|--------|
| ImgBB | ✅ Primary (new uploads) |
| Cloudinary | ✅ Fallback + existing images remain accessible |
| Firebase Storage | ✅ Last resort fallback |
| Picsum placeholder | ❌ Removed (was providing fake images) |

**Existing image URLs are NOT migrated.** All existing Cloudinary/Firebase Storage URLs in Firestore continue to work — the display components accept any HTTP URL. New uploads go to ImgBB.

## SmartImage Component

`src/shared/components/SmartImage.tsx` — reusable image display component:

- Loading skeleton state
- Broken URL fallback (SVG placeholder)
- Missing URL fallback (gray box)
- Fallback image support
- Lazy loading
- Responsive object-fit
- No page break on invalid URL
