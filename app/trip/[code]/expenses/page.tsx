'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Expense {
  id: string
  title: string
  amount: number
  paid_at: string
  payer_name: string
  slip_url: string | null
  split_count: number
}

export default function ExpensesPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [tripId, setTripId] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data: tripData } = await supabase.from('trips').select('id').eq('code', code).single()
    if (!tripData) { router.push('/'); return }
    setTripId(tripData.id)

    const { data: expData } = await supabase
      .from('expenses')
      .select('id, title, amount, paid_at, slip_url, paid_by(name), expense_splits(id)')
      .eq('trip_id', tripData.id)
      .order('paid_at', { ascending: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setExpenses((expData ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      amount: Number(e.amount),
      paid_at: e.paid_at,
      payer_name: e.paid_by?.name ?? '?',
      slip_url: e.slip_url,
      split_count: e.expense_splits?.length ?? 0,
    })))
    setLoading(false)
  }, [code, router])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = expenses.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.payer_name.toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 })
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="pulse-soft" style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: '2rem' }}>🧾</div>
        <p>กำลังโหลด...</p>
      </div>
    </div>
  )

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <Link href={`/trip/${code}`} id="back-btn" className="back-btn">←</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>รายการค่าใช้จ่ายทั้งหมด</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>รวม {fmt(total)} ฿</p>
        </div>
        <Link
          href={`/trip/${code}/expense/new`}
          id="add-expense-link"
          className="btn-primary"
          style={{ padding: '0.55rem 0.875rem', fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          + เพิ่ม
        </Link>
      </div>

      {/* Search */}
      <div className="field fade-up">
        <input
          id="expense-search"
          placeholder="🔍 ค้นหารายการ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary strip */}
      <div className="card fade-up" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', animationDelay: '0.05s' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>{filtered.length}</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>รายการ</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(total)}</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>ยอดรวม (฿)</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧾</div>
          <p style={{ color: 'var(--muted)' }}>{search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการค่าใช้จ่าย'}</p>
        </div>
      ) : (
        filtered.map((e, i) => (
          <Link
            key={e.id}
            href={`/trip/${code}/expense/${e.id}`}
            id={`expense-item-${e.id}`}
            className="card fade-up"
            style={{
              display: 'block', marginBottom: '0.625rem', textDecoration: 'none', color: 'inherit',
              animationDelay: `${i * 0.03}s`,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={el => (el.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={el => (el.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.15rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span>จ่ายโดย {e.payer_name}</span>
                  <span>·</span>
                  <span>{fmtDate(e.paid_at)}</span>
                  {e.slip_url && <span>📎</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                  แบ่ง {e.split_count} คน
                </div>
              </div>
              <div style={{ marginLeft: '0.75rem', textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{fmt(e.amount)} ฿</div>
                <div style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>แก้ไข →</div>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
