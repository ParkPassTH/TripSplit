'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { writeLog } from '@/lib/log'

const BANKS = [
  'กสิกรไทย (KBank)', 'ไทยพาณิชย์ (SCB)', 'กรุงไทย (KTB)',
  'กรุงเทพ (BBL)', 'ทหารไทยธนชาต (TTB)', 'กรุงศรี (BAY)',
  'ออมสิน', 'ธ.ก.ส.', 'อื่นๆ',
]

type BankType = 'bank' | 'promptpay' | 'truewallet'

export default function ProfilePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [tripId, setTripId] = useState('')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [bankType, setBankType] = useState<BankType>('bank')
  const [bankName, setBankName] = useState(BANKS[0])
  const [accountNumber, setAccountNumber] = useState('')
  const [promptpay, setPromptpay] = useState('')
  const [truewallet, setTruewallet] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('id').eq('code', code).single()
    if (!tripData) { router.push('/'); return }
    setTripId(tripData.id)

    const savedId = localStorage.getItem(`ts_member_${code}`)
    if (!savedId) { router.push(`/trip/${code}`); return }
    setMemberId(savedId)

    const { data: m } = await supabase.from('members').select('*').eq('id', savedId).single()
    if (!m) return
    setMemberName(m.name)
    if (m.bank_type)      setBankType(m.bank_type as BankType)
    if (m.bank_name)      setBankName(m.bank_name)
    if (m.account_number) setAccountNumber(m.account_number)
    if (m.promptpay)      setPromptpay(m.promptpay)
    if (m.truewallet)     setTruewallet(m.truewallet)
  }, [code, router])

  useEffect(() => { fetchData() }, [fetchData])

  const currentValue =
    bankType === 'bank' ? accountNumber :
    bankType === 'promptpay' ? promptpay : truewallet

  async function handleSave() {
    if (!memberId || !tripId) return
    setSaving(true)
    const patch = {
      bank_type: bankType,
      bank_name:      bankType === 'bank' ? bankName : null,
      account_number: bankType === 'bank' ? accountNumber : null,
      promptpay:      bankType === 'promptpay' ? promptpay : null,
      truewallet:     bankType === 'truewallet' ? truewallet : null,
    }
    await supabase.from('members').update(patch).eq('id', memberId)
    await writeLog(tripId, memberId, 'UPDATE', 'member', null, patch)
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleCopy() {
    if (!currentValue) return
    navigator.clipboard.writeText(currentValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <Link href={`/trip/${code}`} id="back-btn" className="back-btn">←</Link>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>ข้อมูลรับเงิน</h1>
          {memberName && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{memberName}</p>}
        </div>
      </div>

      {/* Bank type tabs */}
      <div className="card fade-up" style={{ marginBottom: '1rem' }}>
        <label className="label">ช่องทางรับเงิน</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {([
            { v: 'bank',       emoji: '🏦', label: 'บัญชีธนาคาร' },
            { v: 'promptpay',  emoji: '📱', label: 'พร้อมเพย์' },
            { v: 'truewallet', emoji: '👛', label: 'TrueWallet' },
          ] as const).map(t => (
            <button
              key={t.v}
              id={`banktype-${t.v}`}
              onClick={() => setBankType(t.v)}
              style={{
                border: `2px solid ${bankType === t.v ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '0.875rem',
                padding: '0.65rem 0.25rem',
                background: bankType === t.v ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: bankType === t.v ? 'var(--accent)' : 'var(--muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{t.emoji}</div>
              {t.label}
            </button>
          ))}
        </div>

        {bankType === 'bank' && (
          <>
            <div className="field">
              <label className="label">ธนาคาร</label>
              <select id="bank-name-select" value={bankName} onChange={e => setBankName(e.target.value)}>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">เลขบัญชี</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="account-number-input"
                  placeholder="xxx-x-xxxxx-x"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  inputMode="numeric"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  onClick={handleCopy}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: copied ? 'var(--green)' : 'var(--muted)', fontSize: '1.1rem' }}
                >
                  {copied ? '✅' : '📋'}
                </button>
              </div>
            </div>
          </>
        )}

        {bankType === 'promptpay' && (
          <div className="field">
            <label className="label">เบอร์โทร หรือ เลขบัตรประชาชน</label>
            <div style={{ position: 'relative' }}>
              <input
                id="promptpay-input"
                placeholder="0812345678"
                value={promptpay}
                onChange={e => setPromptpay(e.target.value)}
                inputMode="numeric"
                style={{ paddingRight: '3rem' }}
              />
              <button
                onClick={handleCopy}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: copied ? 'var(--green)' : 'var(--muted)', fontSize: '1.1rem' }}
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
          </div>
        )}

        {bankType === 'truewallet' && (
          <div className="field">
            <label className="label">เบอร์โทรที่ผูกกับ TrueWallet</label>
            <div style={{ position: 'relative' }}>
              <input
                id="truewallet-input"
                placeholder="0812345678"
                value={truewallet}
                onChange={e => setTruewallet(e.target.value)}
                inputMode="numeric"
                style={{ paddingRight: '3rem' }}
              />
              <button
                onClick={handleCopy}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: copied ? 'var(--green)' : 'var(--muted)', fontSize: '1.1rem' }}
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
          </div>
        )}

        <button
          id="save-profile-btn"
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✅ บันทึกแล้ว!' : saving ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
        </button>
      </div>

      <Link
        href={`/trip/${code}`}
        id="back-dashboard-link"
        className="btn-ghost"
        style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        ← กลับหน้าหลัก
      </Link>
    </div>
  )
}
