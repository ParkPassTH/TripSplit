'use client'

import { useState, useEffect } from 'react'

interface PinModalProps {
  tripCode: string
  memberId: string
  /** called only after correct PIN entered (or when no PIN was set yet and user sets one) */
  onClose: () => void
  /** called when user chooses to skip instead of setting a PIN — only available in 'set' mode */
  onSkip?: () => void
}

export default function PinModal({ tripCode, memberId, onClose, onSkip }: PinModalProps) {
  const storageKey = `ts_pin_${tripCode}_${memberId}`
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [mode, setMode] = useState<'set' | 'verify'>('set')
  const [error, setError] = useState('')
  const [shakeClass, setShakeClass] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    // If a PIN hash already exists → verify mode (cannot skip)
    setMode(saved ? 'verify' : 'set')
  }, [storageKey])

  function triggerShake() {
    setShakeClass('shake')
    setTimeout(() => setShakeClass(''), 400)
  }

  function handleDigit(d: string) {
    setError('')
    if (mode === 'set') {
      if (pin.length < 4)       setPin(p => p + d)
      else if (confirmPin.length < 4) setConfirmPin(p => p + d)
    } else {
      if (pin.length < 4) setPin(p => p + d)
    }
  }

  function handleBack() {
    setError('')
    if (mode === 'set') {
      if (confirmPin.length > 0) setConfirmPin(p => p.slice(0, -1))
      else                       setPin(p => p.slice(0, -1))
    } else {
      setPin(p => p.slice(0, -1))
    }
  }

  // Auto-check when full PIN entered
  useEffect(() => {
    if (mode === 'set') {
      if (pin.length === 4 && confirmPin.length === 4) {
        if (pin === confirmPin) {
          localStorage.setItem(storageKey, pin)
          onClose()
        } else {
          setError('PIN ไม่ตรงกัน กรุณาลองใหม่')
          triggerShake()
          setPin(''); setConfirmPin('')
        }
      }
    } else {
      if (pin.length === 4) {
        const saved = localStorage.getItem(storageKey)
        if (!saved || pin === saved) {
          onClose()
        } else {
          setError('PIN ไม่ถูกต้อง กรุณาลองใหม่')
          triggerShake()
          setPin('')
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, confirmPin])

  const activePin = mode === 'set' && pin.length === 4 ? confirmPin : pin
  const isVerifyMode = mode === 'verify'

  const subLabel =
    isVerifyMode
      ? 'ใส่ PIN ของคุณเพื่อยืนยันตัวตน'
      : pin.length < 4
        ? 'ตั้ง PIN 4 หลักสำหรับล็อกชื่อของคุณ'
        : 'ยืนยัน PIN อีกครั้ง'

  return (
    <>
      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        .shake { animation: shake 0.4s ease; }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999, backdropFilter: 'blur(10px)',
      }}>
        <div className={shakeClass} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '1.5rem',
          padding: '2rem 1.5rem',
          width: '100%', maxWidth: 320,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
          <h2 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
            {isVerifyMode ? 'ยืนยัน PIN' : 'ตั้ง PIN'}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {subLabel}
          </p>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                width: 18, height: 18, borderRadius: '50%',
                background: i < activePin.length ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.15s',
                boxShadow: i < activePin.length ? '0 0 8px rgba(99,102,241,0.5)' : 'none',
              }} />
            ))}
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '0.875rem' }}>{error}</p>
          )}

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem' }}>
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                id={`pin-digit-${d}`}
                onClick={() => handleDigit(d)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: '0.875rem', padding: '1rem',
                  fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)',
                  transition: 'background 0.1s',
                }}
                onMouseDown={e => (e.currentTarget.style.background = 'var(--border)')}
                onMouseUp={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onTouchStart={e => (e.currentTarget.style.background = 'var(--border)')}
                onTouchEnd={e => (e.currentTarget.style.background = 'var(--surface2)')}
              >
                {d}
              </button>
            ))}

            {/* Bottom row: skip(set only) | 0 | backspace */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!isVerifyMode && (
                <button
                  id="pin-skip-btn"
                  onClick={() => { onSkip ? onSkip() : onClose() }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8rem' }}
                >
                  ข้าม
                </button>
              )}
            </div>

            <button
              id="pin-digit-0"
              onClick={() => handleDigit('0')}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '0.875rem', padding: '1rem',
                fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)',
              }}
            >0</button>

            <button
              id="pin-backspace"
              onClick={handleBack}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.4rem' }}
            >⌫</button>
          </div>

          {isVerifyMode && (
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
              ลืม PIN? แจ้งเจ้าของทริปเพื่อ reset
            </p>
          )}
        </div>
      </div>
    </>
  )
}
