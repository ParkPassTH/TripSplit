export interface Transfer {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

export interface BalanceEntry {
  memberId: string
  memberName: string
  net: number
}

/**
 * Greedy minimization of required transfers.
 * Positive net  => creditor (to receive money)
 * Negative net  => debtor   (to pay money)
 */
export function minimizeTransactions(balances: BalanceEntry[]): Transfer[] {
  const eps = 0.01
  const debtors  = balances.filter(b => b.net < -eps).map(b => ({ ...b, net: b.net }))
  const creditors = balances.filter(b => b.net >  eps).map(b => ({ ...b, net: b.net }))

  const transfers: Transfer[] = []

  let di = 0
  let ci = 0

  while (di < debtors.length && ci < creditors.length) {
    const debtor   = debtors[di]
    const creditor = creditors[ci]

    const amount = Math.min(-debtor.net, creditor.net)
    transfers.push({
      fromId:   debtor.memberId,
      fromName: debtor.memberName,
      toId:     creditor.memberId,
      toName:   creditor.memberName,
      amount:   Math.round(amount * 100) / 100,
    })

    debtor.net   += amount
    creditor.net -= amount

    if (Math.abs(debtor.net)   < eps) di++
    if (Math.abs(creditor.net) < eps) ci++
  }

  return transfers
}
