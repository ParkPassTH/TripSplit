import { supabase } from './supabase'

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIRM'
export type LogEntity = 'expense' | 'settlement' | 'member' | 'trip'

export async function writeLog(
  tripId: string,
  memberId: string | null,
  action: LogAction,
  entity: LogEntity,
  oldVal: object | null,
  newVal: object | null
) {
  await supabase.from('activity_logs').insert({
    trip_id: tripId,
    member_id: memberId,
    action,
    entity,
    old_val: oldVal,
    new_val: newVal,
  })
}
