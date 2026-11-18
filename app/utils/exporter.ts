import { toCanvas } from 'html-to-image'
import { zipSync } from 'fflate'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

// Downloads are made in the browser from the same visual the preview shows, at the platform's size.

export type Size = { w: number; h: number; label: string }
export const SIZES = {
  wide: { w: 1600, h: 900, label: '1600×900' },
  portrait: { w: 1080, h: 1350, label: '1080×1350' },
  square: { w: 1080, h: 1080, label: '1080×1080' },
  story: { w: 1080, h: 1920, label: '1080×1920' },
} satisfies Record<string, Size>

export const aspectOf = (s: Size) => `${s.w} / ${s.h}`

// Waits until the staged visual has its fonts and background images, so the capture is complete.
async function settled(el: HTMLElement) {
  await document.fonts.ready
  const urls = [...el.querySelectorAll<HTMLElement>('*')].map(n => getComputedStyle(n).backgroundImage).flatMap(b => [...b.matchAll(/url\("?([^")]+)"?\)/g)].map(m => m[1]!))
  await Promise.all(urls.map(u => new Promise<void>((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = u })))
  // A timer, not requestAnimationFrame: a background tab never fires rAF, and a download must still finish there.
  await new Promise(r => setTimeout(r, 60))
}

export async function capture(el: HTMLElement, size: Size): Promise<HTMLCanvasElement> {
  await settled(el)
  return toCanvas(el, { width: size.w, height: size.h, canvasWidth: size.w, canvasHeight: size.h, pixelRatio: 1, cacheBust: false })
}

export const canvasBlob = (c: HTMLCanvasElement, type = 'image/png', q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not make the image.'))), type, q))

export function save(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export async function zip(files: { name: string; blob: Blob }[]) {
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer())
  return new Blob([zipSync(entries, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

// A minimal PDF: one JPEG per page, each page the image's own size. LinkedIn shows a PDF as a swipeable carousel.
export async function pdf(pages: HTMLCanvasElement[]) {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); length += u.length }
  const obj = (n: number, body: (Uint8Array | string)[]) => { offsets[n] = length; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n') }
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const n = pages.length
  const pageIds = pages.map((_, i) => 3 + i * 3)
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  obj(2, [`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${n} >>`])
  for (const [i, c] of pages.entries()) {
    const id = pageIds[i]!
    const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer())
    const draw = `q ${c.width} 0 0 ${c.height} 0 0 cm /Im0 Do Q`
    obj(id, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${c.width} ${c.height}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`])
    obj(id + 1, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`])
    obj(id + 2, [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream'])
  }
  const xref = length
  const total = 3 + n * 3
  push(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let k = 1; k < total; k++) push(`${String(offsets[k] ?? 0).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

// Clip: each frame holds for `hold` seconds with a slow push-in, then cross-fades into the next. Encoded to H.264 MP4.
export async function mp4(frames: HTMLCanvasElement[], size: Size, onProgress?: (p: number) => void, hold = 2.5) {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot make videos. Try Chrome, Edge or Safari 17+.')
  const fps = 30
  const fade = 0.35
  const config: VideoEncoderConfig = { codec: 'avc1.640028', width: size.w, height: size.h, bitrate: 6_000_000, framerate: fps }
  if (!(await VideoEncoder.isConfigSupported(config)).supported) config.codec = 'avc1.4d0028'
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: size.w, height: size.h }, fastStart: 'in-memory' })
  let failure: unknown
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e } })
  encoder.configure(config)
  const canvas = new OffscreenCanvas(size.w, size.h)
  const ctx = canvas.getContext('2d')!
  const total = Math.round(frames.length * hold * fps)
  const drawFrame = (img: HTMLCanvasElement, t: number, alpha: number) => {
    const s = 1 + 0.045 * Math.min(1, t / hold) // slow push-in over the hold
    ctx.globalAlpha = alpha
    ctx.drawImage(img, (size.w - size.w * s) / 2, (size.h - size.h * s) / 3, size.w * s, size.h * s)
  }
  for (let f = 0; f < total; f++) {
    if (failure) throw failure
    const time = f / fps
    const j = Math.min(frames.length - 1, Math.floor(time / hold))
    const local = time - j * hold
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size.w, size.h)
    drawFrame(frames[j]!, local, 1)
    const next = frames[j + 1]
    if (next && local > hold - fade) drawFrame(next, 0, (local - (hold - fade)) / fade)
    const vf = new VideoFrame(canvas, { timestamp: Math.round(time * 1e6), duration: Math.round(1e6 / fps) })
    encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 })
    vf.close()
    if (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 0))
    if (f % 15 === 0) onProgress?.(f / total)
  }
  await encoder.flush()
  if (failure) throw failure
  muxer.finalize()
  onProgress?.(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

// A recorded clip at any size, with its captions burned in the same way the preview shows them:
// over the video when wide, under it when tall. Frames are taken by seeking, so a hidden tab still works.
export async function mp4FromVideo(src: string, captions: { at?: number; cap: string }[], size: Size, brand: { ground: string; ink: string; font: string }, onProgress?: (p: number) => void) {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot make videos. Try Chrome, Edge or Safari 17+.')
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.src = src
  await new Promise<void>((res, rej) => { video.onloadeddata = () => res(); video.onerror = () => rej(new Error('Could not load the recording.')) })
  await document.fonts.load(`600 40px '${brand.font}'`).catch(() => {})
  const fps = 30
  const config: VideoEncoderConfig = { codec: 'avc1.640028', width: size.w, height: size.h, bitrate: 6_000_000, framerate: fps }
  if (!(await VideoEncoder.isConfigSupported(config)).supported) config.codec = 'avc1.4d0028'
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: size.w, height: size.h }, fastStart: 'in-memory' })
  let failure: unknown
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e } })
  encoder.configure(config)
  const canvas = new OffscreenCanvas(size.w, size.h)
  const ctx = canvas.getContext('2d')!
  const tall = size.h > size.w
  const W = size.w
  const wrap = (text: string, max: number) => {
    const lines: string[] = []
    let line = ''
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > max && line) { lines.push(line); line = word } else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  const total = Math.floor(video.duration * fps)
  for (let f = 0; f < total; f++) {
    if (failure) throw failure
    const t = f / fps
    video.currentTime = t
    await new Promise(r => video.addEventListener('seeked', r, { once: true }))
    const cap = [...captions].reverse().find(c => (c.at ?? 0) <= t)?.cap ?? captions[0]?.cap ?? ''
    ctx.fillStyle = brand.ground
    ctx.fillRect(0, 0, size.w, size.h)
    if (tall) {
      const vh = W / (video.videoWidth / video.videoHeight)
      ctx.drawImage(video, 0, 0, W, vh)
      ctx.font = `600 ${W * 0.066}px '${brand.font}', system-ui, sans-serif`
      ctx.fillStyle = brand.ink
      wrap(cap, W * 0.86).forEach((l, k) => ctx.fillText(l, W * 0.07, size.h * 0.57 + W * 0.066 * (1 + k * 1.1)))
    } else {
      const scale = Math.max(size.w / video.videoWidth, size.h / video.videoHeight)
      ctx.drawImage(video, (size.w - video.videoWidth * scale) / 2, 0, video.videoWidth * scale, video.videoHeight * scale)
      const fs = W * 0.039
      ctx.font = `600 ${fs}px '${brand.font}', system-ui, sans-serif`
      const lines = wrap(cap, W * 0.92 - W * 0.048)
      const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + W * 0.048
      const boxH = lines.length * fs * 1.1 + W * 0.028
      const x = W * 0.04
      const y = size.h * 0.95 - boxH
      ctx.globalAlpha = 0.9
      ctx.fillStyle = brand.ground
      ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, W * 0.016); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = brand.ink
      lines.forEach((l, k) => ctx.fillText(l, x + W * 0.024, y + W * 0.014 + fs * (0.85 + k * 1.1)))
    }
    const vf = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) })
    encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 })
    vf.close()
    if (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 0))
    if (f % 15 === 0) onProgress?.(f / total)
  }
  await encoder.flush()
  if (failure) throw failure
  muxer.finalize()
  onProgress?.(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}
