'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function WelcomePage() {
  const router = useRouter()

  const [tab, setTab] = useState<'create' | 'join'>('create')

  // Create trip
  const [tripName, setTripName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [creating, setCreating] = useState(false)

  // Join trip
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  async function handleCreate() {
    if (!tripName.trim()) return
    setCreating(true)
    try {
      const payload: Record<string, string> = { name: tripName.trim(), code: '' }
      if (startsAt) payload.starts_at = startsAt
      if (endsAt)   payload.ends_at   = endsAt

      const { data, error } = await supabase
        .from('trips')
        .insert(payload)
        .select('code')
        .single()

      if (error) throw error
      router.push(`/trip/${data.code}`)
    } catch (e) {
      console.error(e)
      alert('สร้างทริปไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return
    setJoining(true)
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('id')
        .eq('code', code)
        .single()

      if (error || !data) {
        alert('ไม่พบรหัสทริปนี้ กรุณาตรวจสอบอีกครั้ง')
        return
      }
      router.push(`/trip/${code}`)
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="page-wrapper" style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      minHeight: '100vh', paddingTop: '2rem', paddingBottom: '2rem',
    }}>
      {/* Logo */}
      <div className="fade-up" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 72, height: 72, borderRadius: '1.5rem',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          marginBottom: '1rem', fontSize: '2rem',
          boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
        }}>✈️</div>
        <h1 style={{
          fontSize: '2rem', fontWeight: 700,
          background: 'linear-gradient(135deg, #a5b4fc, #c4b5fd)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          TripSplit
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: '0.4rem', fontSize: '0.95rem' }}>
          แบ่งค่าใช้จ่ายทริปกับเพื่อน โปร่งใส ไม่มั่ว
        </p>
      </div>

      {/* Tabs */}
      <div className="card fade-up" style={{ animationDelay: '0.05s' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'var(--surface2)', borderRadius: '0.875rem',
          padding: '4px', marginBottom: '1.5rem',
        }}>
          {(['create', 'join'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'var(--surface)' : 'transparent',
                border: 'none', borderRadius: '0.75rem', padding: '0.6rem',
                color: tab === t ? 'var(--text)' : 'var(--muted)',
                fontWeight: tab === t ? 600 : 400, fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              {t === 'create' ? '🗺️ สร้างทริป' : '🔑 เข้าร่วมทริป'}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <div className="fade-up">
            <div className="field">
              <label className="label">ชื่อทริป</label>
              <input
                id="trip-name-input"
                placeholder="เช่น ทริปเกาะสมุย 2025"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label">วันเริ่มต้น</label>
                <input
                  id="trip-starts-input"
                  type="date"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">วันสิ้นสุด</label>
                <input
                  id="trip-ends-input"
                  type="date"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                />
              </div>
            </div>
            <button
              id="create-trip-btn"
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={handleCreate}
              disabled={creating || !tripName.trim()}
            >
              {creating ? 'กำลังสร้าง...' : 'สร้างทริปใหม่ 🚀'}
            </button>
          </div>
        ) : (
          <div className="fade-up">
            <div className="field">
              <label className="label">รหัสทริป 6 หลัก</label>
              <input
                id="join-code-input"
                placeholder="เช่น AB12CD"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }}
              />
            </div>
            <button
              id="join-trip-btn"
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={handleJoin}
              disabled={joining || joinCode.trim().length !== 6}
            >
              {joining ? 'กำลังเข้าร่วม...' : 'เข้าร่วมทริป →'}
            </button>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
        ไม่ต้องสมัครสมาชิก · ใช้ได้ทันที
      </p>
    </div>
  )
}
