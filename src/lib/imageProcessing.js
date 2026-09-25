export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_STORED_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_DIMENSION = 2400
export const NORMALIZED_IMAGE_MIME = 'image/webp'

const downloadFormats = {
  jpg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
}

function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(blob))
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-decode-failed')) }
    image.src = url
  })
}

function canvasBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('image-encode-failed')), mime, quality)
  })
}

function renderImage(image, maxDimension, background = null) {
  const sourceWidth = image.width || image.naturalWidth
  const sourceHeight = image.height || image.naturalHeight
  if (!sourceWidth || !sourceHeight) throw new Error('image-dimensions-missing')

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

function imageFile(blob, name = 'vh-imports-imagem.webp') {
  return new File([blob], name, { type: NORMALIZED_IMAGE_MIME, lastModified: Date.now() })
}

export async function normalizeImage(file) {
  if (!file || typeof file.size !== 'number') throw new Error('image-invalid')
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('image-source-too-large')
  if (file.type && !file.type.startsWith('image/')) throw new Error('image-type-unsupported')

  let image
  try {
    image = await decodeImage(file)
    const attempts = [
      { maxDimension: MAX_IMAGE_DIMENSION, quality: 0.9 },
      { maxDimension: MAX_IMAGE_DIMENSION, quality: 0.82 },
      { maxDimension: 2000, quality: 0.78 },
      { maxDimension: 1600, quality: 0.72 },
    ]
    for (const attempt of attempts) {
      const canvas = renderImage(image, attempt.maxDimension)
      const blob = await canvasBlob(canvas, NORMALIZED_IMAGE_MIME, attempt.quality)
      if (blob.size <= MAX_STORED_IMAGE_BYTES) {
        return { file: imageFile(blob), width: canvas.width, height: canvas.height, originalType: file.type || 'desconhecido', originalSize: file.size, normalizedSize: blob.size }
      }
    }
    throw new Error('image-output-too-large')
  } catch (error) {
    if (error.message === 'image-source-too-large' || error.message === 'image-type-unsupported' || error.message === 'image-output-too-large') throw error
    throw new Error('image-unsupported')
  } finally {
    image?.close?.()
  }
}

export function getDownloadFormat(format) {
  return downloadFormats[format] || downloadFormats.jpg
}

export async function convertImageForDownload(blob, format = 'jpg') {
  const selected = getDownloadFormat(format)
  const image = await decodeImage(blob)
  try {
    const canvas = renderImage(image, MAX_IMAGE_DIMENSION, selected.extension === 'jpg' ? '#ffffff' : null)
    return canvasBlob(canvas, selected.mime, selected.extension === 'jpg' ? 0.92 : undefined)
  } finally {
    image?.close?.()
  }
}

export function downloadName(path, format = 'jpg') {
  const selected = getDownloadFormat(format)
  const original = String(path || 'foto').split('/').pop() || 'foto'
  const base = original.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'foto'
  return `${base}.${selected.extension}`
}
