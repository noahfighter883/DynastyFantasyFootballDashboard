export type AcquisitionType = 'Startup Draft' | 'Rookie Draft' | 'Trade' | 'Waiver'

export interface Acquisition {
  type: AcquisitionType
  // True when this wasn't a direct record for the current owner -- the
  // roster changed hands and this is inferred from the previous
  // manager's history instead (see build_acquisition_map's docstring).
  inherited: boolean
  season: string | null
  // Draft pick position within its round, only set for the two draft types.
  round?: number | null
  pick?: number | null
  // FAAB spent on a waiver claim, only set for Waiver; 0 for a zero-cost
  // free-agent add rather than a real bid.
  faab?: number | null
}

export type AcquisitionMap = Record<string, Acquisition | null>

export const ACQUISITION_TYPES: AcquisitionType[] = ['Startup Draft', 'Rookie Draft', 'Trade', 'Waiver']

export function acquisitionDetail(a: Acquisition): string | null {
  if ((a.type === 'Startup Draft' || a.type === 'Rookie Draft') && a.round != null && a.pick != null) {
    return `${a.round}.${String(a.pick).padStart(2, '0')}`
  }
  if (a.type === 'Waiver' && a.faab != null) {
    return a.faab > 0 ? `$${a.faab} FAAB` : 'FA'
  }
  return null
}

export function acquisitionStyle(type: AcquisitionType): { color: string; background: string } {
  if (type === 'Startup Draft') return { color: '#818cf8', background: 'rgba(129,140,248,0.1)' }
  if (type === 'Rookie Draft') return { color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }
  if (type === 'Trade') return { color: '#fb923c', background: 'rgba(251,146,60,0.1)' }
  return { color: '#34d399', background: 'rgba(52,211,153,0.08)' }
}
