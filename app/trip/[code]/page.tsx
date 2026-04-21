'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { computeBalances, MemberBalance } from '@/lib/balance'
import PinModal from '@/components/PinModal'

interface Trip { id: string; name: string; code: string; starts_at: string | null; ends_at: string | null }
interface Member { id: string; name: string }
interface Expense {
  id: string; title: string; amount: number;
  paid_at: string; payer_name: string; slip_url: string | null
}

function daysUntil(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return 'สิ้นสุดแล้ว'
  if (diff === 0) return 'สิ้นสุดวันนี้'
  return `เหลืออีก ${diff} วัน`
}

export default function DashboardPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [balances, setBalances] = useState<MemberBalance[]>([])
  const [loading, setLoading] = useState(true)

  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => {
    const key = `ts_member_${code}`
    const saved = localStorage.getItem(key)
    if (saved) setCurrentMemberId(saved)
  }, [code])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data: tripData } = await supabase.from('trips').select('*').eq('code', code).single()
      if (!tripData) { router.push('/'); return }
      setTrip(tripData)

      const { data: memberData } = await supabase.from('members').select('id, name').eq('trip_id', tripData.id)
      setMembers(memberData ?? [])

      const { data: expData } = await supabase
        .from('expenses')
        .select('id, title, amount, paid_at, slip_url, paid_by(name)')
        .eq('trip_id', tripData.id)
        .order('paid_at', { ascending: false })
        .limit(5)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setExpenses((expData ?? []).map((e: any) => ({
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        paid_at: e.paid_at,
        payer_name: e.paid_by?.name ?? '?',
        slip_url: e.slip_url,
      })))

      const bal = await computeBalances(tripData.id)
      setBalances(bal)
    } finally {
      setLoading(false)
    }
  }, [code, router])

  useEffect(() => { fetchAll() }, [fetchAll])

  const myBalance = balances.find(b => b.memberId === currentMemberId)

  async function addMember() {
    if (!newMemberName.trim() || !trip) return
    setAddingMember(true)
    const { data } = await supabase
      .from('members')
      .insert({ trip_id: trip.id, name: newMemberName.trim() })
      .select('id')
      .single()
    if (data) {
      localStorage.setItem(`ts_member_${code}`, data.id)
      setCurrentMemberId(data.id)
      setNewMemberName('')
      setShowAddMember(false)
      await fetchAll()
      setShowPinModal(true)   // set PIN for new member
    }
    setAddingMember(false)
  }

  function selectMember(id: string) {
    localStorage.setItem(`ts_member_${code}`, id)
    setCurrentMemberId(id)
    setShowPinModal(true)    // verify PIN for existing member
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="pulse-soft" style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✈️</div>
        <p style={{ color: 'var(--muted)' }}>กำลังโหลดทริป...</p>
      </div>
    </div>
  )

  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 })
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const fmtShortDate = (s: string) =>
    new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  const countdown = daysUntil(trip?.ends_at ?? null)

  return (
    <div className="page-wrapper">
      {/* ── Header ─────────────────────────────── */}
      <div className="fade-up" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {trip?.name}
            </h1>

            {/* Trip dates + countdown */}
            {(trip?.starts_at || trip?.ends_at) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                {trip?.starts_at && trip?.ends_at && (
                  <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                    {fmtShortDate(trip.starts_at)} → {fmtShortDate(trip.ends_at)}
                  </span>
                )}
                {countdown && (
                  <span className={`badge ${countdown === 'สิ้นสุดแล้ว' ? 'badge-gray' : 'badge-green'}`}
                    style={{ fontSize: '0.7rem' }}>
                    {countdown === 'สิ้นสุดแล้ว' ? '⛳ ' : '⏳ '}{countdown}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
              <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>รหัส: {trip?.code}</span>
              <button
                id="copy-code-btn"
                onClick={() => { navigator.clipboard.writeText(trip?.code ?? '') }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8rem', padding: 0 }}
              >📋</button>
            </div>
          </div>

          {/* Right icon group */}
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {currentMemberId && (
              <Link href={`/trip/${code}/profile`} id="profile-btn" className="back-btn" title="ตั้งค่าบัญชีรับเงิน">
                🏦
              </Link>
            )}
            <Link href={`/trip/${code}/activity`} id="activity-btn" className="back-btn" title="Activity Log">
              📋
            </Link>
          </div>
        </div>
      </div>

      {/* ── Who am I? ──────────────────────────── */}
      {!currentMemberId ? (
        <div className="card fade-up" style={{ marginBottom: '1.25rem', animationDelay: '0.05s' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>👤 คุณคือใครในทริปนี้?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {members.map(m => (
              <button
                key={m.id}
                id={`select-member-${m.id}`}
                onClick={() => selectMember(m.id)}
                className="btn-ghost"
                style={{ padding: '0.45rem 0.875rem', borderRadius: '99px', fontSize: '0.85rem' }}
              >
                {m.name}
              </button>
            ))}
          </div>
          {!showAddMember ? (
            <button id="show-add-member-btn" onClick={() => setShowAddMember(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem' }}>
              + เพิ่มชื่อตัวเอง
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="new-member-name-input"
                placeholder="ชื่อของคุณ"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
                style={{ flex: 1 }}
              />
              <button id="add-member-btn" className="btn-primary" style={{ whiteSpace: 'nowrap' }}
                onClick={addMember} disabled={addingMember}>
                {addingMember ? '...' : 'เพิ่ม'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card fade-up" style={{ marginBottom: '1.25rem', animationDelay: '0.05s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>ยอดของคุณ</span>
            <button
              id="switch-member-btn"
              onClick={() => { localStorage.removeItem(`ts_member_${code}`); setCurrentMemberId(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.78rem' }}
            >
              เปลี่ยนผู้ใช้
            </button>
          </div>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
            👤 {members.find(m => m.id === currentMemberId)?.name}
          </p>
          {myBalance ? (
            <div style={{
              borderRadius: '0.875rem', padding: '1rem',
              background: myBalance.net >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${myBalance.net >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: myBalance.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {myBalance.net >= 0 ? '+' : ''}{fmt(myBalance.net)} ฿
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {myBalance.net > 0 ? '🎉 คุณจะได้รับเงินคืน' : myBalance.net < 0 ? '⚠️ คุณต้องจ่ายเพื่อน' : '✅ เคลียร์แล้ว'}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                <span>จ่ายไป: <strong style={{ color: 'var(--text)' }}>{fmt(myBalance.paid)} ฿</strong></span>
                <span>ส่วนแบ่ง: <strong style={{ color: 'var(--text)' }}>{fmt(myBalance.owed)} ฿</strong></span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>ยังไม่มีรายการ</p>
          )}
        </div>
      )}

      {/* ── All balances ────────────────────────── */}
      <div className="card fade-up" style={{ marginBottom: '1.25rem', animationDelay: '0.1s' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.875rem' }}>📊 ยอดรวมทุกคน</p>
        {balances.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>ยังไม่มีรายการค่าใช้จ่าย</p>}
        {balances.map(b => (
          <div key={b.memberId} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.5rem 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontWeight: b.memberId === currentMemberId ? 600 : 400 }}>
              {b.memberId === currentMemberId ? '👤 ' : ''}{b.memberName}
            </span>
            <span style={{ fontWeight: 600, color: b.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {b.net >= 0 ? '+' : ''}{fmt(b.net)} ฿
            </span>
          </div>
        ))}
      </div>

      {/* ── Recent expenses ─────────────────────── */}
      <div className="fade-up" style={{ marginBottom: '1.5rem', animationDelay: '0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 600 }}>🧾 รายการล่าสุด</p>
          <Link href={`/trip/${code}/expenses`} style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>ดูทั้งหมด →</Link>
        </div>

        {expenses.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧾</div>
            <p style={{ color: 'var(--muted)' }}>ยังไม่มีรายการค่าใช้จ่าย</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.4rem' }}>กด "+ เพิ่มรายการ" เพื่อเริ่มต้น</p>
          </div>
        )}

        {expenses.map(e => (
          <Link
            key={e.id}
            href={`/trip/${code}/expense/${e.id}`}
            id={`expense-card-${e.id}`}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.625rem', textDecoration: 'none', color: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={el => (el.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={el => (el.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                จ่ายโดย {e.payer_name} · {fmtDate(e.paid_at)}
                {e.slip_url && <span style={{ marginLeft: '0.4rem' }}>📎</span>}
              </div>
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem', marginLeft: '0.75rem', flexShrink: 0 }}>
              {fmt(e.amount)} ฿
            </span>
          </Link>
        ))}
      </div>

      {/* ── Bottom action bar ───────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '1rem',
        background: 'linear-gradient(to top, var(--bg) 60%, transparent)',
        display: 'flex', gap: '0.75rem', justifyContent: 'center',
      }}>
        <Link
          id="settle-btn"
          href={`/trip/${code}/settle`}
          className="btn-ghost"
          style={{ flex: 1, maxWidth: 200, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          💸 เคลียร์เงิน
        </Link>
        <Link
          id="add-expense-btn"
          href={`/trip/${code}/expense/new`}
          className="btn-primary"
          style={{ flex: 1, maxWidth: 200, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          + เพิ่มรายการ
        </Link>
      </div>

      {showPinModal && currentMemberId && trip && (
        <PinModal
          tripCode={code}
          memberId={currentMemberId}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  )
}
