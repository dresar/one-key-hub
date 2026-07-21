import axios from 'axios';
import crypto from 'crypto';
import { db } from '../db/client';
import { cdnFiles } from '../db/schema';
import { getCachedCredentials } from './credentialSync';
import { reportCredentialFailure } from '../lib/rotate';
import { v4 as uuidv4 } from 'uuid';

export interface StorageUploadParams {
  gatewayKeyId: string;
  file: string; // Base64 string (data:image/png;base64,...) or remote URL
  fileName?: string;
  autoRotate?: boolean; // Default true (fix EXIF orientation)
  targetProvider?: string; // Optional specific provider requested by client
}

export interface StorageUploadResult {
  id: string;
  gatewayKeyId: string;
  provider: string;
  fileId: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  autoRotated: boolean;
  createdAt: Date;
}

// ─── Provider Implementations ──────────────────────────────────────────────────

/**
 * Upload to ImageKit.io
 * Credential format: public_key|private_key|url_endpoint
 */
async function uploadToImageKit(
  creds: Record<string, string>,
  params: StorageUploadParams
): Promise<{ fileId: string; url: string; width?: number; height?: number; size?: number; mimeType?: string }> {
  const apiKeyRaw = creds.api_key || creds.credentials || '';
  const parts = apiKeyRaw.split('|').map((p) => p.trim());
  
  const publicKey = creds.public_key || parts[0] || '';
  const privateKey = creds.private_key || parts[1] || '';
  const urlEndpoint = creds.url_endpoint || parts[2] || '';

  if (!privateKey) {
    throw new Error('ImageKit private_key is missing from credential');
  }

  const fileName = params.fileName || `img_${Date.now()}.png`;

  const authHeader = 'Basic ' + Buffer.from(`${privateKey}:`).toString('base64');

  const formData = new URLSearchParams();
  formData.append('file', params.file);
  formData.append('fileName', fileName);
  formData.append('useUniqueFileName', 'true');
  if (params.autoRotate !== false) {
    formData.append('isPrivateFile', 'false');
  }

  const response = await axios.post('https://upload.imagekit.io/api/v1/files/upload', formData, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 30000,
  });

  const data = response.data;
  return {
    fileId: data.fileId || data.name,
    url: data.url,
    width: data.width,
    height: data.height,
    size: data.size,
    mimeType: data.fileType === 'image' ? 'image/jpeg' : 'application/octet-stream',
  };
}

/**
 * Upload to Cloudinary
 * Credential format: cloud_name|api_key|api_secret
 */
async function uploadToCloudinary(
  creds: Record<string, string>,
  params: StorageUploadParams
): Promise<{ fileId: string; url: string; width?: number; height?: number; size?: number; mimeType?: string }> {
  const apiKeyRaw = creds.api_key || creds.credentials || '';
  const parts = apiKeyRaw.split('|').map((p) => p.trim());

  const cloudName = creds.cloud_name || parts[0] || '';
  const apiKey = creds.cloudinary_api_key || parts[1] || '';
  const apiSecret = creds.api_secret || parts[2] || '';

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials (cloud_name|api_key|api_secret) incomplete');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  
  // Build signature with auto-rotation (angle=auto)
  const angleParam = params.autoRotate !== false ? 'auto' : '';
  let paramsToSign: Record<string, string | number> = { timestamp };
  if (angleParam) {
    paramsToSign.angle = angleParam;
  }

  // Sort keys alphabetically for Cloudinary signature calculation
  const sortedKeys = Object.keys(paramsToSign).sort();
  const signString = sortedKeys.map((key) => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;
  const signature = crypto.createHash('sha1').update(signString).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', params.file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  if (angleParam) {
    formData.append('angle', angleParam);
  }

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    formData,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    }
  );

  const data = response.data;
  return {
    fileId: data.public_id,
    url: data.secure_url || data.url,
    width: data.width,
    height: data.height,
    size: data.bytes,
    mimeType: data.resource_type ? `${data.resource_type}/${data.format || 'png'}` : 'image/png',
  };
}

/**
 * Upload to Uploadcare
 * Credential format: public_key|secret_key
 */
async function uploadToUploadcare(
  creds: Record<string, string>,
  params: StorageUploadParams
): Promise<{ fileId: string; url: string; width?: number; height?: number; size?: number; mimeType?: string }> {
  const apiKeyRaw = creds.api_key || creds.credentials || '';
  const parts = apiKeyRaw.split('|').map((p) => p.trim());

  const publicKey = creds.public_key || parts[0] || '';
  if (!publicKey) {
    throw new Error('Uploadcare public_key missing from credential');
  }

  const formData = new URLSearchParams();
  formData.append('UPLOADCARE_PUB_KEY', publicKey);
  formData.append('UPLOADCARE_STORE', '1');

  if (params.file.startsWith('http://') || params.file.startsWith('https://')) {
    formData.append('source_url', params.file);
    const response = await axios.post('https://upload.uploadcare.com/from_url/', formData, { timeout: 30000 });
    const token = response.data.token;
    
    // Poll status briefly
    let fileId = token;
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusRes = await axios.get(`https://upload.uploadcare.com/from_url/status/?token=${token}`);
      if (statusRes.data.status === 'success') {
        fileId = statusRes.data.file_id;
        break;
      }
    }
    return {
      fileId,
      url: `https://ucarecdn.com/${fileId}/`,
    };
  } else {
    formData.append('file', params.file);
    const response = await axios.post('https://upload.uploadcare.com/base/', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    });
    const fileId = response.data.file;
    return {
      fileId,
      url: `https://ucarecdn.com/${fileId}/`,
    };
  }
}

// ─── Failover Upload Manager ──────────────────────────────────────────────────

const STORAGE_PROVIDERS = ['imagekit', 'cloudinary', 'uploadcare'];

export async function uploadWithFailover(params: StorageUploadParams): Promise<StorageUploadResult> {
  const autoRotate = params.autoRotate !== false;
  let providerList = params.targetProvider ? [params.targetProvider.toLowerCase()] : [...STORAGE_PROVIDERS];

  // If specific provider requested, also append remaining storage providers as backup
  if (params.targetProvider) {
    STORAGE_PROVIDERS.forEach((p) => {
      if (!providerList.includes(p)) providerList.push(p);
    });
  }

  let lastError: Error | null = null;

  for (const provider of providerList) {
    // Fetch active credentials for this storage provider
    const credsList = getCachedCredentials(provider).filter((c) => c.status === 'active');
    if (credsList.length === 0) {
      continue; // No active keys for this provider, try next provider in chain!
    }

    for (const cred of credsList) {
      try {
        console.log(`[StorageGateway] Attempting upload to provider "${provider}" using credential #${cred.id}...`);

        let uploadRes: { fileId: string; url: string; width?: number; height?: number; size?: number; mimeType?: string };

        if (provider === 'imagekit') {
          uploadRes = await uploadToImageKit(cred.credentials, params);
        } else if (provider === 'cloudinary') {
          uploadRes = await uploadToCloudinary(cred.credentials, params);
        } else if (provider === 'uploadcare') {
          uploadRes = await uploadToUploadcare(cred.credentials, params);
        } else {
          continue;
        }

        console.log(`[StorageGateway] ✅ Upload successful via ${provider}: ${uploadRes.url}`);

        // Extract file size / mime type / name defaults
        const fileSize = uploadRes.size || Math.round((params.file.length * 3) / 4);
        const fileName = params.fileName || uploadRes.fileId || `file_${Date.now()}`;
        const mimeType = uploadRes.mimeType || 'image/png';

        // Insert record into cdn_files table
        const [record] = await db
          .insert(cdnFiles)
          .values({
            id: uuidv4(),
            gatewayKeyId: params.gatewayKeyId,
            provider,
            credentialId: Number(cred.id),
            fileId: uploadRes.fileId,
            url: uploadRes.url,
            fileName,
            fileSize,
            mimeType,
            width: uploadRes.width || null,
            height: uploadRes.height || null,
            autoRotated: autoRotate,
          })
          .returning();

        return {
          id: record.id,
          gatewayKeyId: record.gatewayKeyId,
          provider: record.provider,
          fileId: record.fileId || '',
          url: record.url,
          fileName: record.fileName || '',
          fileSize: record.fileSize || 0,
          mimeType: record.mimeType || 'image/png',
          width: record.width || undefined,
          height: record.height || undefined,
          autoRotated: record.autoRotated ?? true,
          createdAt: record.createdAt,
        };
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
        console.warn(`[StorageGateway] ⚠️ Failover trigger: Upload failed on ${provider} (Cred #${cred.id}): ${errMsg}`);
        lastError = err;

        // Mark credential failure so system auto-rotates to another key
        await reportCredentialFailure(String(cred.id), errMsg);
      }
    }
  }

  throw new Error(`Semua provider storage (ImageKit, Cloudinary, Uploadcare) gagal atau tidak tersedia. Error terakhir: ${lastError?.message || 'Tidak ada credential aktif'}`);
}
