'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface SlipUploadProps {
  tripId: string
  onUploaded: (url: string) => void
  currentUrl: string | null
}

export default function SlipUpload({ tripId, onUploaded, currentUrl }: SlipUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)

  async function handleFile(file: File) {
    if (!file || !tripId) return
    setUploading(true)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${tripId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('slips').upload(path, file, { upsert: true })
    if (error) {
      console.error(error)
      alert('อัปโหลดสลิปไม่สำเร็จ')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('slips').getPublicUrl(path)
    setPreview(data.publicUrl)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {preview ? (
        <div style={{ position: 'relative', borderRadius: '0.875rem', overflow: 'hidden', marginBottom: '0.5rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="สลิปที่อัปโหลด"
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
          />
          <button
            id="slip-change-btn"
            onClick={() => inputRef.current?.click()}
            style={{
              position: 'absolute', bottom: '0.5rem', right: '0.5rem',
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: '0.625rem',
              color: '#fff',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            เปลี่ยนสลิป
          </button>
        </div>
      ) : (
        <button
          id="slip-upload-btn"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%',
            border: '2px dashed var(--border)',
            borderRadius: '0.875rem',
            padding: '1.5rem',
            background: 'transparent',
            color: uploading ? 'var(--muted)' : 'var(--accent)',
            fontSize: '0.9rem',
            textAlign: 'center',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          {uploading ? (
            <span className="pulse-soft">⏳ กำลังอัปโหลด...</span>
          ) : (
            <>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📷</div>
              ถ่ายรูปสลิป หรือเลือกจากอัลบั้ม
            </>
          )}
        </button>
      )}
    </div>
  )
}
