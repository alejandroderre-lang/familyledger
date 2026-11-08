import imageCompression from 'browser-image-compression'
import heic2any from 'heic2any'
import { supabase } from '@/lib/supabase'
import type { ParsedReceiptData } from '@/types'

const STORAGE_BUCKET = 'receipts'

function isHeic(file: File): boolean {
  return (
    file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')
  )
}

/**
 * Prepare an image for upload: convert HEIC → JPEG first (canvas-based
 * compression can't decode HEIC), then compress to <=1MB / 1920px.
 */
export async function prepareImage(file: File): Promise<File> {
  let working: File = file

  if (isHeic(file)) {
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    })
    const blob = Array.isArray(converted) ? converted[0] : converted
    working = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
    })
  }

  return imageCompression(working, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  })
}

export interface UploadResult {
  receiptId: string
  parsed: ParsedReceiptData | null
}

/** Error thrown when parsing fails but a receipt row exists (manual entry). */
export class ParseFailedError extends Error {
  receiptId: string
  /** Machine-readable cause from the edge function, when it supplied one. */
  code?: string
  constructor(receiptId: string, code?: string, message = 'Failed to parse receipt') {
    super(message)
    this.name = 'ParseFailedError'
    this.receiptId = receiptId
    this.code = code
  }
}

/**
 * Not every parse failure is an unreadable image — a missing API key or an
 * unreachable function look identical from the client unless we distinguish
 * them. Only `unreadable` should be blamed on the photo.
 */
export function isImageQualityFailure(code?: string): boolean {
  return code === 'unreadable' || code === undefined
}

/**
 * Compress + upload the image, create a receipt row, then call the
 * parse-receipt edge function. Returns the receipt id and parsed data.
 */
export async function uploadAndParseReceipt(
  file: File,
  userId: string,
): Promise<UploadResult> {
  const compressed = await prepareImage(file)
  const ext = compressed.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, compressed, { contentType: compressed.type })
  if (uploadError) throw uploadError

  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({ user_id: userId, image_url: path, status: 'processing' })
    .select()
    .single()
  if (receiptError) throw receiptError

  const { data, error: fnError } = await supabase.functions.invoke(
    'parse-receipt',
    { body: { receipt_id: receipt.id, image_url: path } },
  )
  if (fnError) {
    // The function returns a JSON body with `code` on the failures it can
    // identify; surface it so the UI doesn't blame every fault on the photo.
    let code: string | undefined
    let detail: string | undefined
    const context = (fnError as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json()
        code = body?.code
        detail = body?.error
      } catch {
        // Non-JSON error body — fall through with no code.
      }
    }
    if (detail) console.error('parse-receipt failed:', code ?? 'unknown', detail)
    // The receipt row exists — let the caller offer manual entry.
    throw new ParseFailedError(receipt.id, code, detail)
  }

  return {
    receiptId: receipt.id,
    parsed: (data?.parsed ?? null) as ParsedReceiptData | null,
  }
}

/** Create an empty receipt row so the user can enter details manually. */
export async function createBlankReceipt(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({ user_id: userId, image_url: '', status: 'error' })
    .select()
    .single()
  if (error) throw error
  return data.id as string
}
