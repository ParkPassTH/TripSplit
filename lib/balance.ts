import { supabase } from './supabase'

export interface MemberBalance {
  memberId: string
  memberName: string
  paid: number       // total paid as payer
  owed: number       // total share
  net: number        // paid - owed  (positive = gets money back, negative = owes)
}

export async function computeBalances(tripId: string): Promise<MemberBalance[]> {
  // Fetch members
  const { data: members, error: mErr } = await supabase
    .from('members')
    .select('id, name')
    .eq('trip_id', tripId)
  if (mErr) throw mErr

  // Fetch expenses with paid_by
  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('id, amount, paid_by')
    .eq('trip_id', tripId)
  if (eErr) throw eErr

  const expenseIds = expenses?.map(e => e.id) ?? []

  // Fetch all splits for this trip
  const { data: splits, error: sErr } = expenseIds.length > 0
    ? await supabase
        .from('expense_splits')
        .select('expense_id, member_id, amount')
        .in('expense_id', expenseIds)
    : { data: [], error: null }
  if (sErr) throw sErr

  // Only count confirmed settlements so partially-settled trips stay accurate
  const { data: settlements, error: stErr } = await supabase
    .from('settlements')
    .select('from_member, to_member, amount')
    .eq('trip_id', tripId)
    .eq('status', 'confirmed')
  if (stErr) throw stErr

  // Build balance map
  const balanceMap: Record<string, { paid: number; owed: number }> = {}
  members?.forEach(m => { balanceMap[m.id] = { paid: 0, owed: 0 } })

  expenses?.forEach(e => {
    if (balanceMap[e.paid_by] !== undefined) {
      balanceMap[e.paid_by].paid += Number(e.amount)
    }
  })

  splits?.forEach(s => {
    if (balanceMap[s.member_id] !== undefined) {
      balanceMap[s.member_id].owed += Number(s.amount)
    }
  })

  // Apply confirmed settlements (reduce net debt/credit)
  settlements?.forEach(s => {
    if (balanceMap[s.from_member] !== undefined) balanceMap[s.from_member].paid += Number(s.amount)
    if (balanceMap[s.to_member]   !== undefined) balanceMap[s.to_member].owed  += Number(s.amount)
  })

  return members!.map(m => ({
    memberId: m.id,
    memberName: m.name,
    paid: balanceMap[m.id].paid,
    owed: balanceMap[m.id].owed,
    net: balanceMap[m.id].paid - balanceMap[m.id].owed,
  }))
}
