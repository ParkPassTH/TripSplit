'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { computeBalances } from '@/lib/balance'
import { minimizeTransactions, Transfer } from '@/lib/settlement'
import { writeLog } from '@/lib/log'
import SlipUpload from '@/components/SlipUpload'

interface Member { id: string; name: string; bank_type?: string; bank_name?: string; account_number?: string; promptpay?: string; truewallet?: string }
interface Settlement { id: string; from_member: string; to_member: string; amount: number; slip_url: string | null; status: string; from_name: string; to_name: string }

export default function SettlePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [tripId, setTripId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data: tripData } = await supabase.from('trips').select('id').eq('code', code).single()
      if (!tripData) { router.push('/'); return }
      setTripId(tripData.id)

      const saved = localStorage.getItem(`ts_member_${code}`)
      setCurrentMemberId(saved)

      const { data: memberData } = await supabase.from('members').select('*').eq('trip_id', tripData.id)
      setMembers(memberData ?? [])

      const balances = await computeBalances(tripData.id)
      setTransfers(minimizeTransactions(balances))

      const { data: sData } = await supabase
        .from('settlements')
        .select('*')
        .eq('trip_id', tripData.id)
        .order('created_at', { ascending: false })

      const mMap = Object.fromEntries((memberData ?? []).map(m => [m.id, m.name]))
      setSettlements((sData ?? []).map(s => ({
        ...s,
        amount: Number(s.amount),
        from_name: mMap[s.from_member] ?? '?',
        to_name:   mMap[s.to_member]   ?? '?',
      })))
    } finally {
      setLoading(false)
    }
  }, [code, router])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function createSettlement(t: Transfer) {
    if (!tripId) return
    const { data } = await supabase
      .from('settlements')
      .insert({ trip_id: tripId, from_member: t.fromId, to_member: t.toId, amount: t.amount })
      .select('id')
      .single()

    await writeLog(tripId, currentMemberId, 'CREATE', 'settlement', null, {
      from: t.fromId, to: t.toId, amount: t.amount,
    })

    if (data) await fetchAll()
  }

  async function confirmSettlement(id: string, fromId: string, toId: string, amount: number) {
    setConfirmingId(id)
    await supabase
      .from('settlements')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', id)

    await writeLog(tripId, currentMemberId, 'CONFIRM', 'settlement', { status: 'pending' }, { status: 'confirmed', amount })
    await fetchAll()
    setConfirmingId(null)
  }

  async function attachSlip(id: string, url: string) {
    setUploadingId(null)
    await supabase.from('settlements').update({ slip_url: url }).eq('id', id)
    await fetchAll()
  }

  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 })

  const getPayInfo = (m: Member) => {
    if (m.bank_type === 'bank')       return `${m.bank_name} ${m.account_number}`
    if (m.bank_type === 'promptpay')  return `พร้อมเพย์ ${m.promptpay}`
    if (m.bank_type === 'truewallet') return `TrueWallet ${m.truewallet}`
    return 'ยังไม่มีข้อมูลบัญชี'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="pulse-soft" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💸</div>
        <p style={{ color: 'var(--muted)' }}>กำลังคำนวณ...</p>
      </div>
    </div>
  )

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <Link href={`/trip/${code}`} id="back-btn" className="back-btn">←</Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>เคลียร์เงิน</h1>
      </div>

      {/* Suggested transfers */}
      <div className="card fade-up" style={{ marginBottom: '1rem' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.875rem' }}>💡 แนะนำให้โอน ({transfers.length} รายการ)</p>
        {transfers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
            <p style={{ color: 'var(--muted)' }}>ทุกคนเคลียร์กันหมดแล้ว!</p>
          </div>
        ) : transfers.map((t, i) => {
          const toMember = members.find(m => m.id === t.toId)
          const alreadyCreated = settlements.some(
            s => s.from_member === t.fromId && s.to_member === t.toId && s.status !== 'confirmed'
          )
          return (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.fromName}</span>
                  <span style={{ color: 'var(--muted)', margin: '0 0.35rem' }}>→</span>
                  <span style={{ fontWeight: 600 }}>{t.toName}</span>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.05rem' }}>{fmt(t.amount)} ฿</span>
              </div>
              {toMember && (
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🏦 {getPayInfo(toMember)}
                  {(toMember.account_number || toMember.promptpay || toMember.truewallet) && (
                    <button
                      onClick={() => navigator.clipboard.writeText(toMember.account_number ?? toMember.promptpay ?? toMember.truewallet ?? '')}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem' }}
                    >📋</button>
                  )}
                </div>
              )}
              {!alreadyCreated && (
                <button
                  id={`create-settlement-${i}`}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                  onClick={() => createSettlement(t)}
                >
                  โอนแล้ว – สร้างรายการ
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Existing settlements */}
      {settlements.length > 0 && (
        <div className="fade-up" style={{ animationDelay: '0.1s' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>📋 รายการโอน</p>
          {settlements.map(s => (
            <div key={s.id} className="card" style={{ marginBottom: '0.625rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{s.from_name}</span>
                  <span style={{ color: 'var(--muted)', margin: '0 0.35rem' }}>→</span>
                  <span style={{ fontWeight: 600 }}>{s.to_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700 }}>{fmt(s.amount)} ฿</span>
                  <span className={`badge ${s.status === 'confirmed' ? 'badge-green' : 'badge-gray'}`}>
                    {s.status === 'confirmed' ? '✅ ยืนยัน' : '⏳ รอ'}
                  </span>
                </div>
              </div>

              {s.status !== 'confirmed' && (
                <>
                  {s.slip_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <a href={s.slip_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                        📎 ดูสลิป
                      </a>
                      {currentMemberId === s.to_member && (
                        <button
                          id={`confirm-settlement-${s.id}`}
                          className="btn-primary"
                          style={{ fontSize: '0.82rem', padding: '0.45rem 0.875rem' }}
                          disabled={confirmingId === s.id}
                          onClick={() => confirmSettlement(s.id, s.from_member, s.to_member, s.amount)}
                        >
                          {confirmingId === s.id ? '...' : '✅ ยืนยันรับเงิน'}
                        </button>
                      )}
                    </div>
                  ) : currentMemberId === s.from_member ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>อัปโหลดสลิปการโอน</p>
                      <SlipUpload
                        tripId={tripId}
                        onUploaded={(url) => attachSlip(s.id, url)}
                        currentUrl={null}
                      />
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                      รอ {s.from_name} อัปโหลดสลิป
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
