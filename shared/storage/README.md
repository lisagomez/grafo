# 📁 File Storage Module

This module provides file upload and storage with multiple provider support.

## 📦 Dependencies

Add these to your `package.json`:

### Backend (Node.js/Express)
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.500.0",
    "@aws-sdk/s3-request-presigner": "^3.500.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

**OR** for UploadThing:
```json
{
  "dependencies": {
    "uploadthing": "^6.3.0"
  }
}
```

### Frontend (Next.js)
```json
{
  "dependencies": {
    "@uploadthing/react": "^6.2.0"
  }
}
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Storage Provider
STORAGE_PROVIDER=s3  # or 'uploadthing', 'local'

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_S3_ENDPOINT=  # Optional: for S3-compatible services

# UploadThing
UPLOADTHING_SECRET=sk_live_xxxxx
UPLOADTHING_APP_ID=xxxxx

# Upload limits
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=image/*,application/pdf
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── components/
│       ├── FileUpload.tsx
│       ├── ImageUpload.tsx
│       └── FilePreview.tsx
├── backend/
│   └── routes/uploads.js
└── shared/storage/
    ├── lib/
    │   ├── storage.js
    │   └── providers/
    │       ├── s3.js
    │       ├── uploadthing.js
    │       └── local.js
    └── README.md
```

## 🚀 Usage

### Backend - Storage Service

```javascript
import { StorageService } from './lib/storage.js';

const storage = new StorageService({
  provider: process.env.STORAGE_PROVIDER
});

// Upload a file
const result = await storage.upload({
  file: buffer,
  filename: 'document.pdf',
  contentType: 'application/pdf',
  folder: 'documents'
});
// Returns: { url, key, size }

// Generate presigned upload URL (for direct browser uploads)
const { uploadUrl, key } = await storage.getPresignedUploadUrl({
  filename: 'image.png',
  contentType: 'image/png',
  folder: 'avatars',
  expiresIn: 3600 // 1 hour
});

// Generate presigned download URL
const downloadUrl = await storage.getPresignedDownloadUrl({
  key: 'avatars/image.png',
  expiresIn: 3600
});

// Delete a file
await storage.delete('avatars/image.png');

// List files in a folder
const files = await storage.list('documents');
```

### Backend - Upload Routes

```javascript
import multer from 'multer';
import { StorageService } from './lib/storage.js';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const storage = new StorageService();

// Direct upload
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const result = await storage.upload({
      file: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      folder: `users/${req.user.id}`
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get presigned upload URL
router.post('/presigned-url', authMiddleware, async (req, res) => {
  const { filename, contentType } = req.body;
  
  const { uploadUrl, key } = await storage.getPresignedUploadUrl({
    filename,
    contentType,
    folder: `users/${req.user.id}`
  });
  
  res.json({ uploadUrl, key });
});
```

### Frontend - File Upload Component

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Upload, X, File, Image } from 'lucide-react';

interface FileUploadProps {
  onUpload: (url: string) => void;
  accept?: string;
  maxSize?: number; // in MB
}

export function FileUpload({ 
  onUpload, 
  accept = '*', 
  maxSize = 10 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get presigned URL
      const response = await fetch('/api/uploads/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type
        })
      });

      const { uploadUrl, key } = await response.json();

      // Upload directly to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      // Construct final URL
      const fileUrl = `${process.env.NEXT_PUBLIC_CDN_URL}/${key}`;
      
      setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
      onUpload(fileUrl);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [maxSize, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}
        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="Preview" className="max-h-32 rounded" />
          <button
            onClick={() => setPreview(null)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            Drag and drop or{' '}
            <label className="text-primary-500 cursor-pointer hover:underline">
              browse
              <input
                type="file"
                accept={accept}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                className="hidden"
              />
            </label>
          </p>
          <p className="text-sm text-gray-400">Max size: {maxSize}MB</p>
        </>
      )}
      
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      {isUploading && <p className="text-primary-500 text-sm mt-2">Uploading...</p>}
    </div>
  );
}
```

### Frontend - Avatar Upload

```tsx
export function AvatarUpload({ currentAvatar, onUpdate }) {
  const handleUpload = async (url: string) => {
    await fetch('/api/user/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: url })
    });
    onUpdate(url);
  };

  return (
    <div className="flex items-center gap-4">
      <img 
        src={currentAvatar || '/default-avatar.png'} 
        className="w-20 h-20 rounded-full object-cover"
      />
      <FileUpload 
        onUpload={handleUpload}
        accept="image/*"
        maxSize={5}
      />
    </div>
  );
}
```

## 📊 Provider Comparison

| Feature | AWS S3 | UploadThing | Local |
|---------|--------|-------------|-------|
| Hosting | AWS | Managed | Self |
| Free Tier | 5GB | 2GB | ∞ |
| CDN | CloudFront | Built-in | ❌ |
| Presigned URLs | ✅ | ✅ | ❌ |
| Image Processing | Lambda | Built-in | ❌ |

## 🔒 Security

```javascript
// Validate file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new Error('File type not allowed');
  }
  
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large');
  }
}
```

## ❓ Need Help?

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3)
- [UploadThing Documentation](https://docs.uploadthing.com)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

