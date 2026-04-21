'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface LogEntry {
  id: string
  action: string
  entity: string
  old_val: Record<string, unknown> | null
  new_val: Record<string, unknown> | null
  created_at: string
  member_name?: string
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: '➕ สร้าง',
  UPDATE: '✏️ แก้ไข',
  DELETE: '🗑️ ลบ',
  CONFIRM: '✅ ยืนยัน',
}

const ENTITY_LABELS: Record<string, string> = {
  expense: 'ค่าใช้จ่าย',
  settlement: 'การโอนเงิน',
  member: 'ข้อมูลสมาชิก',
  trip: 'ทริป',
}

export default function ActivityPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('id').eq('code', code).single()
    if (!tripData) { router.push('/'); return }

    const { data } = await supabase
      .from('activity_logs')
      .select('*, members(name)')
      .eq('trip_id', tripData.id)
      .order('created_at', { ascending: false })
      .limit(100)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLogs((data ?? []).map((l: any) => ({ ...l, member_name: l.members?.name })))
    setLoading(false)
  }, [code, router])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="pulse-soft" style={{ color: 'var(--muted)', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>📋</div>
        <p>กำลังโหลด...</p>
      </div>
    </div>
  )

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <Link href={`/trip/${code}`} id="back-btn" className="back-btn">←</Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Activity Log</h1>
      </div>

      {logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <p style={{ color: 'var(--muted)' }}>ยังไม่มีการเคลื่อนไหว</p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: '0.4rem', top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

          {logs.map((l, i) => (
            <div key={l.id} className="fade-up" style={{ position: 'relative', marginBottom: '1rem', animationDelay: `${i * 0.03}s` }}>
              {/* Dot */}
              <div style={{
                position: 'absolute', left: '-1.25rem', top: '0.6rem',
                width: 10, height: 10, borderRadius: '50%',
                background: l.action === 'CONFIRM' ? 'var(--green)' : l.action === 'DELETE' ? 'var(--red)' : 'var(--accent)',
                border: '2px solid var(--bg)',
              }} />

              <div className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {ACTION_LABELS[l.action] ?? l.action} {ENTITY_LABELS[l.entity] ?? l.entity}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{fmtDate(l.created_at)}</span>
                </div>
                {l.member_name && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>โดย {l.member_name}</p>
                )}
                {(l.new_val || l.old_val) && (
                  <details style={{ marginTop: '0.4rem' }}>
                    <summary style={{ color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer' }}>ดูรายละเอียด</summary>
                    <pre style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify({ old: l.old_val, new: l.new_val }, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
