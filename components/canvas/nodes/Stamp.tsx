import type { CSSProperties } from 'react'
import type { StatusNode } from '@/lib/schema'

const STAMP_TEXT: Record<StatusNode, string> = { sukses: 'Pass', separuh: 'Partial', gagal: 'Failed' }
const STAMP_COLOR: Record<StatusNode, string> = {
  sukses: 'text-stamp-green',
  separuh: 'text-stamp-amber',
  gagal: 'text-stamp-red',
}
const STAMP_TILT: Record<StatusNode, string> = { sukses: '-4deg', separuh: '3deg', gagal: '-6deg' }

export function Stamp({ status, className = '' }: { status: StatusNode; className?: string }) {
  return (
    <span
      className={`stamp ${STAMP_COLOR[status]} ${className}`}
      style={{ '--stamp-tilt': STAMP_TILT[status] } as CSSProperties}
    >
      {STAMP_TEXT[status]}
    </span>
  )
}
