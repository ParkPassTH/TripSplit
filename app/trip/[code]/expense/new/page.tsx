'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { writeLog } from '@/lib/log'
import SlipUpload from '@/components/SlipUpload'

interface Member { id: string; name: string }

export default function NewExpensePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [tripId, setTripId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [paidAt, setPaidAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('id').eq('code', code).single()
    if (!tripData) { router.push('/'); return }
    setTripId(tripData.id)

    const { data: memberData } = await supabase.from('members').select('id, name').eq('trip_id', tripData.id)
    const mems = memberData ?? []
    setMembers(mems)

    const saved = localStorage.getItem(`ts_member_${code}`)
    if (saved) {
      setCurrentMemberId(saved)
      setPaidBy(saved)
      setSelectedMembers(mems.map(m => m.id))
    } else {
      setSelectedMembers(mems.map(m => m.id))
    }
  }, [code, router])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleMember(id: string) {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const totalAmt = parseFloat(amount) || 0
  const equalShare = selectedMembers.length > 0 ? totalAmt / selectedMembers.length : 0
  const customTotal = Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const customValid = Math.abs(customTotal - totalAmt) < 0.01

  async function handleSave() {
    if (!title.trim() || !amount || !paidBy || !tripId) return
    if (splitType === 'equal' && selectedMembers.length === 0) return
    if (splitType === 'custom' && !customValid) return

    setSaving(true)
    try {
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .insert({
          trip_id: tripId,
          title: title.trim(),
          amount: totalAmt,
          paid_by: paidBy,
          paid_at: new Date(paidAt).toISOString(),
          slip_url: slipUrl,
          created_by: currentMemberId,
        })
        .select('id')
        .single()

      if (expErr) throw expErr

      const splits =
        splitType === 'equal'
          ? selectedMembers.map(id => ({
              expense_id: expData.id,
              member_id: id,
              amount: Math.round((equalShare + Number.EPSILON) * 100) / 100,
            }))
          : Object.entries(customSplits)
              .filter(([, v]) => parseFloat(v) > 0)
              .map(([id, v]) => ({
                expense_id: expData.id,
                member_id: id,
                amount: parseFloat(v),
              }))

      const { error: splitErr } = await supabase.from('expense_splits').insert(splits)
      if (splitErr) throw splitErr

      await writeLog(tripId, currentMemberId, 'CREATE', 'expense', null, {
        title: title.trim(), amount: totalAmt, paid_by: paidBy,
      })

      router.push(`/trip/${code}`)
    } catch (e) {
      console.error(e)
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 })

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <Link href={`/trip/${code}`} id="back-btn" className="back-btn">←</Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>เพิ่มค่าใช้จ่าย</h1>
      </div>

      <div className="card fade-up" style={{ marginBottom: '1rem' }}>
        <div className="field">
          <label className="label">ชื่อรายการ</label>
          <input id="expense-title" placeholder="เช่น ค่าเรือ, ค่าที่พัก" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">ยอดเงิน (บาท)</label>
          <input id="expense-amount" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label">ใครจ่าย</label>
            <select id="expense-payer" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
              <option value="">— เลือก —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">วัน-เวลา</label>
            <input id="expense-datetime" type="datetime-local" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Split type */}
      <div className="card fade-up" style={{ marginBottom: '1rem', animationDelay: '0.05s' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['equal', 'custom'] as const).map(t => (
            <button
              key={t}
              id={`split-type-${t}`}
              onClick={() => setSplitType(t)}
              style={{
                border: `2px solid ${splitType === t ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '0.875rem',
                padding: '0.65rem',
                background: splitType === t ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: splitType === t ? 'var(--accent)' : 'var(--muted)',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              {t === 'equal' ? '⚖️ หารเท่า' : '✏️ กำหนดเอง'}
            </button>
          ))}
        </div>

        {splitType === 'equal' ? (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>เลือกคนที่ร่วมหาร</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {members.map(m => {
                const sel = selectedMembers.includes(m.id)
                return (
                  <button
                    key={m.id}
                    id={`member-toggle-${m.id}`}
                    onClick={() => toggleMember(m.id)}
                    style={{
                      border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '99px',
                      padding: '0.4rem 0.875rem',
                      background: sel ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: sel ? 'var(--accent)' : 'var(--muted)',
                      fontSize: '0.85rem',
                      fontWeight: sel ? 600 : 400,
                      transition: 'all 0.2s',
                    }}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
            {totalAmt > 0 && selectedMembers.length > 0 && (
              <p style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                คนละ <strong style={{ color: 'var(--text)' }}>{fmt(equalShare)} ฿</strong>
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>ระบุยอดรายคน</p>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
                <span style={{ flex: 1, fontWeight: 500 }}>{m.name}</span>
                <input
                  id={`custom-split-${m.id}`}
                  type="number"
                  placeholder="0"
                  value={customSplits[m.id] ?? ''}
                  onChange={e => setCustomSplits(prev => ({ ...prev, [m.id]: e.target.value }))}
                  inputMode="decimal"
                  style={{ width: 110 }}
                />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--muted)' }}>ผลรวม</span>
              <span style={{ color: customValid ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                {fmt(customTotal)} / {fmt(totalAmt)} ฿
              </span>
            </div>
          </>
        )}
      </div>

      {/* Slip upload */}
      <div className="card fade-up" style={{ marginBottom: '1.5rem', animationDelay: '0.1s' }}>
        <label className="label">แนบสลิป (ไม่บังคับ)</label>
        <SlipUpload tripId={tripId} onUploaded={setSlipUrl} currentUrl={slipUrl} />
      </div>

      <button
        id="save-expense-btn"
        className="btn-primary"
        style={{ width: '100%' }}
        disabled={saving || !title.trim() || !amount || !paidBy || (splitType === 'custom' && !customValid) || (splitType === 'equal' && selectedMembers.length === 0)}
        onClick={handleSave}
      >
        {saving ? 'กำลังบันทึก...' : '💾 บันทึกรายการ'}
      </button>
    </div>
  )
}
