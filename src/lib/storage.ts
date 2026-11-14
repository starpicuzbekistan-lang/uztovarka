import { supabase } from './supabase';

export type Bucket = 'content' | 'avatars';

export function publicUrl(bucket: Bucket, path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Rasmni brauzerda kichraytiradi (maks. tomon) va WebP ga o‘giradi — yuklash tezligi uchun. */
export async function optimizeImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Faqat JPG, PNG yoki WebP rasmlar qabul qilinadi.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Rasmni qayta ishlab bo‘lmadi.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
  if (!blob) throw new Error('Rasmni qayta ishlab bo‘lmadi.');
  return blob;
}

export async function uploadImage(bucket: Bucket, folder: string, file: File, maxSide = 1600): Promise<string> {
  const blob = await optimizeImage(file, maxSide);
  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  return path;
}

export async function removeFiles(bucket: Bucket, paths: string[]) {
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}
