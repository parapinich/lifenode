import { TriangleAlert } from 'lucide-react'
import { useRunStore } from '@/lib/runStore'
import { useT } from '@/lib/locale'

export function RiskBadge({ id }: { id: string }) {
  const t = useT()
  const pending = useRunStore((s) => s.pendingRisk)
  const risk = pending?.assessment.nodes.find((n) => n.nodeId === id)
  if (!risk || risk.category === 'safe') return null
  return <div className="mt-2 flex items-start gap-1 text-xs text-stamp-red" title={risk.reason}><TriangleAlert size={13} className="shrink-0" /><span>{t(risk.category === 'fatal' ? 'Fatal action' : risk.category === 'dangerous' ? 'High risk' : 'Risky action')}</span></div>
}
