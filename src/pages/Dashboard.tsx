import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import {
  Users, Briefcase, FolderKanban, TrendingUp, Clock,
  ArrowUpRight, Phone, Mail, CalendarDays, MessageSquare,
  ChevronRight, Sun, Moon, Zap, UserPlus, UploadCloud,
  PlusCircle, Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import React, { useState } from 'react'
import { getAvatarUrl } from '@/utils/avatar'
import LeadModal from '@/components/modals/LeadModal'
import ClientModal from '@/components/modals/ClientModal'
import ProjetModal from '@/components/modals/ProjetModal'
import ImportLeadsModal from '@/components/modals/ImportLeadsModal'

// ── helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 6)  return { text: 'Bonne nuit',    icon: Moon }
  if (h < 12) return { text: 'Bonjour',        icon: Sun  }
  if (h < 18) return { text: 'Bon après-midi', icon: Zap  }
  return       { text: 'Bonsoir',              icon: Moon }
}

function getDailyMessage(taskCount: number): string {
  const dayIndex = Math.floor(Date.now() / 86400000)
  const none   = ["Rien au planning aujourd'hui, c'est l'occasion de prospecter 🎯","Journée libre, parfait pour avancer sur un projet de fond","Pas d'actions prévues, pourquoi ne pas contacter un ancien client ?"]
  const few    = ["Petite journée productive, tu gères ça les yeux fermés 😌","Quelques actions seulement, garde de l'énergie pour la suite","Journée légère, prends le temps de bien faire les choses"]
  const medium = ["Bonne session de travail en vue, t'as ce qu'il faut 💼","Quelques actions à traiter, ça va bien se passer","Planning solide, commence par le plus important"]
  const many   = ["Grosse journée ! Priorise et avance étape par étape 💪","Beaucoup au programme, t'as déjà vu pire 💪","Planning chargé, reste focus et tu t'en sors"]
  const pool   = taskCount === 0 ? none : taskCount <= 2 ? few : taskCount <= 5 ? medium : many
  return pool[dayIndex % pool.length]
}

// ── Circular progress SVG ────────────────────────────────────────────────────

function CircularProgress({ value, size = 110, stroke = 9, color = '#323E83' }: {
  value: number; size?: number; stroke?: number; color?: string
}) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
    </svg>
  )
}

// ── Statut colors ────────────────────────────────────────────────────────────

const STATUT_COLORS: Record<string, { bg: string; text: string }> = {
  'À contacter':  { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
  'Contacté':     { bg: 'rgba(59,130,246,0.12)', text: '#3B82F6' },
  'En discussion':{ bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6' },
  'Devis envoyé': { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
  'RDV fixé':     { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
  'Négociation':  { bg: 'rgba(239,68,68,0.15)',   text: '#EF4444' },
  'Gagné':        { bg: 'rgba(16,185,129,0.15)',  text: '#10B981' },
  'Perdu':        { bg: 'rgba(107,114,128,0.15)', text: '#6B7280' },
}

const ACTION_COLORS: Record<string, string> = {
  'Appel': '#3B82F6', 'Email': '#3B82F6', 'RDV': '#3B82F6',
  'WhatsApp': '#25D366', 'Message': '#3B82F6',
}
const ACTION_ICONS: Record<string, React.ElementType> = {
  'Appel': Phone, 'Email': Mail, 'RDV': CalendarDays,
  'WhatsApp': MessageSquare, 'Message': MessageSquare,
}

// ── Drum / recent activity (compact) ─────────────────────────────────────────

const DRUM_ITEM_H = 72
const DRUM_TYPES = {
  Import:  { icon: UploadCloud,  color: '#2563EB', bg: 'rgba(59,130,246,0.13)' },
  projet:  { icon: FolderKanban, color: '#2563eb', bg: 'rgba(59,130,246,0.13)' },
  lead:    { icon: UserPlus,     color: '#3B82F6', bg: 'rgba(59,130,246,0.13)' },
  default: { icon: PlusCircle,   color: '#3B82F6', bg: 'rgba(59,130,246,0.13)' },
} as const

function DrumActivity({ activites }: { activites: Array<{ id: string; texte?: string; created_at: string }> }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const now = new Date()

  const len = activites.length
  const idx = Math.max(0, Math.min(len - 1, currentIdx))

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let last = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation()
      const now2 = Date.now()
      if (now2 - last < 320) return
      last = now2
      setCurrentIdx(p => Math.max(0, Math.min(len - 1, p + (e.deltaY > 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [len])

  return (
    <div className="flex flex-col h-full" style={{ gap: 10 }}>
      <div className="flex items-center justify-between">
        <h3 className="font-syne font-bold text-sm text-text1">Activité récente</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'var(--surface2)', opacity: idx === 0 ? 0.3 : 1 }}>
            <ChevronRight size={11} style={{ transform: 'rotate(-90deg)', color: 'var(--text2)' }} />
          </button>
          <button onClick={() => setCurrentIdx(i => Math.min(len - 1, i + 1))} disabled={idx === len - 1}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'var(--surface2)', opacity: idx === len - 1 ? 0.3 : 1 }}>
            <ChevronRight size={11} style={{ transform: 'rotate(90deg)', color: 'var(--text2)' }} />
          </button>
        </div>
      </div>

      {len === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 flex-1">
          <Clock size={18} style={{ color: 'var(--border2)' }} />
          <p className="text-xs" style={{ color: 'var(--text3)' }}>Aucune activité</p>
        </div>
      ) : (
        <div ref={viewportRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', userSelect: 'none' }}>
          <div style={{ transform: `translateY(${-idx * DRUM_ITEM_H}px)`, transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)' }}>
            {activites.map((a, i) => {
              const t   = a.texte ?? ''
              const key = t.includes('Import') ? 'Import' : t.includes('projet') ? 'projet' : t.includes('lead') ? 'lead' : 'default'
              const cfg = DRUM_TYPES[key]
              const Icon = cfg.icon
              const date = new Date(a.created_at)
              const isToday = date.toDateString() === now.toDateString()
              const timeStr = isToday
                ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
              const isActive = i === idx
              return (
                <div key={a.id} onClick={() => setCurrentIdx(i)} style={{ height: DRUM_ITEM_H, display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '0 2px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--text1)' : 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</p>
                      <p style={{ fontSize: 12, color: isActive ? 'var(--text2)' : 'var(--text3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {timeStr}
                        {isToday && isActive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
                      </p>
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? cfg.bg : 'transparent', transition: 'background 0.2s' }}>
                      <Icon size={16} style={{ color: isActive ? cfg.color : 'var(--text3)', transition: 'color 0.2s' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to top, var(--surface1) 0%, transparent 100%)', pointerEvents: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { leads, clients, projets, activites } = useDataStore()
  const { profile } = useAuthStore()

  const [showLeadModal,   setShowLeadModal]   = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showProjetModal, setShowProjetModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // ── Metrics
  const leadsTotal      = leads.length
  const clientsActifs   = clients.filter(c => c.statut === 'Actif').length
  const projetsEnCours  = projets.filter(p => p.stage !== 'Livré').length
  const leadsGagnes     = leads.filter(l => l.statut === 'Gagné').length
  const txConversion    = leadsTotal > 0 ? Math.round((leadsGagnes / leadsTotal) * 100) : 0

  const prenom = profile?.full_name?.split(' ')[0] || profile?.nom?.split(' ')[0] || 'toi'
  const { text: greetText } = greeting()

  // ── Today's tasks count (for motivational message)
  const todayStr = new Date().toISOString().split('T')[0]
  const actionsAujourdhui = leads.filter(l => l.prochain_contact?.startsWith(todayStr))
  const dailyMsg = getDailyMessage(actionsAujourdhui.length)

  // ── Recent leads (last 3)
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 3)

  // ── Upcoming tasks (next 30 days)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const limit = new Date(today); limit.setDate(today.getDate() + 30)
  const upcoming = leads
    .filter(l => l.prochain_contact && !['Gagné', 'Perdu'].includes(l.statut))
    .map(l => ({ ...l, d: new Date(l.prochain_contact! + 'T00:00:00') }))
    .filter(l => l.d >= today && l.d <= limit)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .slice(0, 5)

  // ── Pipeline mini bar chart
  const stages = [
    { label: 'Contact',  count: leads.filter(l => l.statut === 'À contacter').length },
    { label: 'Disc.',    count: leads.filter(l => l.statut === 'En discussion').length },
    { label: 'Devis',   count: leads.filter(l => l.statut === 'Devis envoyé').length },
    { label: 'Négoc.',  count: leads.filter(l => l.statut === 'Négociation').length },
    { label: 'Gagné',   count: leads.filter(l => l.statut === 'Gagné').length },
  ]
  const maxStage = Math.max(...stages.map(s => s.count), 1)

  // ── Recent clients
  const recentClients = clients.slice(0, 3)

  return (
    <div className="h-full flex flex-col gap-4 p-4 md:p-6 overflow-hidden animate-fade-in">

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN GRID : left content + right panel
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-4 flex-1 min-h-0">

        {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0 pr-1">

          {/* ── Hero banner ────────────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between"
            style={{ background: 'linear-gradient(135deg, #323E83 0%, #323E83 55%, #3B82F6 100%)', minHeight: 164 }}>

            {/* Decorative star shapes */}
            <svg className="absolute right-8 top-5 opacity-25 pointer-events-none" width="90" height="90" viewBox="0 0 80 80" fill="none">
              <path d="M40 0 L42 35 L80 40 L42 45 L40 80 L38 45 L0 40 L38 35 Z" fill="white" />
            </svg>
            <svg className="absolute right-28 bottom-4 opacity-15 pointer-events-none" width="44" height="44" viewBox="0 0 40 40" fill="none">
              <path d="M20 0 L21 17 L40 20 L21 23 L20 40 L19 23 L0 20 L19 17 Z" fill="white" />
            </svg>
            <svg className="absolute left-[45%] top-3 opacity-10 pointer-events-none" width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path d="M20 0 L21 17 L40 20 L21 23 L20 40 L19 23 L0 20 L19 17 Z" fill="white" />
            </svg>
            <svg className="absolute right-16 top-1/2 opacity-10 pointer-events-none" width="18" height="18" viewBox="0 0 40 40" fill="none">
              <path d="M20 0 L21 17 L40 20 L21 23 L20 40 L19 23 L0 20 L19 17 Z" fill="white" />
            </svg>
            <svg className="absolute left-[60%] bottom-3 opacity-[0.08] pointer-events-none" width="50" height="50" viewBox="0 0 80 80" fill="none">
              <path d="M40 0 L42 35 L80 40 L42 45 L40 80 L38 45 L0 40 L38 35 Z" fill="white" />
            </svg>
            <svg className="absolute right-40 top-2 opacity-[0.12] pointer-events-none" width="22" height="22" viewBox="0 0 40 40" fill="none">
              <path d="M20 0 L21 17 L40 20 L21 23 L20 40 L19 23 L0 20 L19 17 Z" fill="white" />
            </svg>

            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">CRM PERSONNEL</p>
              <h1 className="text-white font-bold text-2xl leading-tight mb-1">
                {greetText} {prenom} 👋
              </h1>
              <p className="text-white/70 text-sm leading-snug max-w-md">{dailyMsg}</p>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button onClick={() => setShowLeadModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(15,10,40,0.7)', color: 'white', backdropFilter: 'blur(8px)' }}>
                <Plus size={14} /> Nouveau lead
              </button>
              <Link to="/pipeline"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.18)', color: 'white', backdropFilter: 'blur(8px)' }}>
                Voir pipeline <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* ── Progress mini-cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: UserPlus,     label: 'Leads',   value: leadsGagnes,   total: leadsTotal,       suffix: 'convertis', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
              { icon: Briefcase,    label: 'Clients', value: clientsActifs,  total: clients.length,  suffix: 'actifs',    color: '#323E83', bg: 'rgba(59,130,246,0.12)'  },
              { icon: FolderKanban, label: 'Projets', value: projetsEnCours, total: projets.length,  suffix: 'en cours',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
            ].map(({ icon: Icon, label, value, total, suffix, color, bg }) => (
              <div key={label} className="card flex items-center gap-3 py-3 hover:border-border2 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text3)' }}>{label}</p>
                  <p className="font-syne font-bold text-base text-text1 leading-tight">
                    {value}
                    <span className="text-xs font-normal" style={{ color: 'var(--text3)' }}>/{total} {suffix}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Recent Leads — card grid ────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-syne font-bold text-sm text-text1">Leads récents</h2>
              <Link to="/leads" className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Voir tout →</Link>
            </div>

            {recentLeads.length === 0 ? (
              <div className="card flex items-center justify-center py-8">
                <p className="text-sm" style={{ color: 'var(--text3)' }}>Aucun lead pour l'instant</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recentLeads.map(lead => {
                  const statut = STATUT_COLORS[lead.statut] ?? { bg: 'var(--surface3)', text: 'var(--text3)' }
                  const name   = lead.nom !== 'Sans nom' ? lead.nom : lead.entreprise || '—'
                  return (
                    <Link to="/leads" key={lead.id}
                      className="card flex flex-col gap-2 hover:border-border2 transition-all group">
                      {/* Avatar + statut */}
                      <div className="flex items-center justify-between">
                        <img src={getAvatarUrl(name)} alt={name}
                          className="w-9 h-9 rounded-xl flex-shrink-0"
                          style={{ background: 'var(--surface2)' }} />
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: statut.bg, color: statut.text }}>
                          {lead.statut}
                        </span>
                      </div>

                      <p className="font-semibold text-sm text-text1 line-clamp-1">{name}</p>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>{lead.entreprise || lead.niche || '—'}</p>

                      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border1)' }}>
                        <span className="text-xs" style={{ color: 'var(--text3)' }}>{lead.type_action || 'Contact'}</span>
                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Upcoming tasks table ────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-syne font-bold text-sm text-text1">Tâches à venir</h2>
              <Link to="/leads" className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Voir tout</Link>
            </div>

            <div className="card overflow-hidden" style={{ padding: 0 }}>
              {/* Header row */}
              <div className="grid text-xs font-semibold uppercase tracking-wider px-4 py-2.5"
                style={{ gridTemplateColumns: '1fr 100px 1fr 80px', color: 'var(--text3)', borderBottom: '1px solid var(--border1)' }}>
                <span>Contact</span>
                <span>Type</span>
                <span>Entreprise</span>
                <span className="text-right">Date</span>
              </div>

              {upcoming.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <p className="text-sm" style={{ color: 'var(--text3)' }}>Aucune tâche planifiée</p>
                </div>
              ) : (
                upcoming.map((l, i) => {
                  const color    = ACTION_COLORS[l.type_action] ?? 'var(--accent)'
                  const isToday2 = l.d.toDateString() === today.toDateString()
                  const dateLabel = isToday2
                    ? "Aujourd'hui"
                    : l.d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  const name = l.nom !== 'Sans nom' ? l.nom : l.entreprise || '—'
                  return (
                    <div key={l.id}
                      className="grid items-center px-4 py-3 hover:bg-surface2 transition-colors"
                      style={{ gridTemplateColumns: '1fr 100px 1fr 80px', borderBottom: i < upcoming.length - 1 ? '1px solid var(--border1)' : 'none' }}>

                      {/* Contact */}
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={getAvatarUrl(name)} alt={name}
                          className="w-7 h-7 rounded-lg flex-shrink-0"
                          style={{ background: 'var(--surface2)' }} />
                        <span className="text-sm font-medium text-text1 truncate">{name}</span>
                      </div>

                      {/* Type */}
                      <div>
                        <span className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: `${color}18`, color }}>
                          {l.type_action || '—'}
                        </span>
                      </div>

                      {/* Entreprise */}
                      <span className="text-xs truncate" style={{ color: 'var(--text3)' }}>{l.entreprise || l.niche || '—'}</span>

                      {/* Date */}
                      <div className="flex justify-end">
                        <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{ background: isToday2 ? 'rgba(16,185,129,0.15)' : 'var(--surface2)', color: isToday2 ? '#10B981' : 'var(--text3)' }}>
                          {dateLabel}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0 pr-1">

          {/* ── Statistic card ─────────────────────────────────────────── */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-sm text-text1">Statistique</h3>
              <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
            </div>

            {/* Circular progress */}
            <div className="relative flex items-center justify-center">
              <CircularProgress value={txConversion} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-syne font-bold text-2xl text-text1">{txConversion}%</span>
              </div>
            </div>

            <div className="text-center -mt-1">
              <p className="font-semibold text-sm text-text1">{greetText} {prenom} 🔥</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Taux de conversion leads</p>
            </div>

            {/* Mini bar chart */}
            <div className="w-full mt-1">
              <div className="flex items-end justify-between gap-1.5" style={{ height: 56 }}>
                {stages.map((s, i) => {
                  const pct     = Math.round((s.count / maxStage) * 100)
                  const isGagne = i === stages.length - 1
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}>
                      <div className="w-full rounded-t-md transition-all duration-700"
                        style={{ height: `${Math.max(pct, 6)}%`, background: isGagne ? '#323E83' : 'rgba(59,130,246,0.35)' }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1">
                {stages.map((s, i) => (
                  <span key={i} className="flex-1 text-center" style={{ fontSize: 9, color: 'var(--text3)' }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Recent clients ──────────────────────────────────────────── */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-sm text-text1">Clients récents</h3>
              <button onClick={() => setShowClientModal(true)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white text-sm font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
                style={{ background: 'var(--accent)' }}>+</button>
            </div>

            {recentClients.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Aucun client</p>
            ) : (
              recentClients.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img src={getAvatarUrl(c.nom || '?')} alt={c.nom || ''}
                      className="w-9 h-9 rounded-full"
                      style={{ background: 'var(--surface2)' }} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                      style={{ background: c.statut === 'Actif' ? '#10B981' : '#6B7280', borderColor: 'var(--surface1)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text1 truncate">{c.nom}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text3)' }}>{c.statut}</p>
                  </div>
                  <Link to="/clients"
                    className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border1)' }}>
                    Voir
                  </Link>
                </div>
              ))
            )}

            <Link to="/clients"
              className="w-full text-center text-xs py-2.5 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)' }}>
              Voir tous les clients
            </Link>
          </div>

          {/* ── Quick actions ───────────────────────────────────────────── */}
          <div className="card flex flex-col gap-2">
            <h3 className="font-syne font-bold text-sm text-text1 mb-1">Actions rapides</h3>
            {[
              { label: 'Nouveau lead',    onClick: () => setShowLeadModal(true),   icon: UserPlus     },
              { label: 'Nouveau client',  onClick: () => setShowClientModal(true), icon: Briefcase    },
              { label: 'Nouveau projet',  onClick: () => setShowProjetModal(true), icon: FolderKanban },
              { label: 'Importer leads',  onClick: () => setShowImportModal(true), icon: UploadCloud  },
            ].map(({ label, onClick, icon: Icon }) => (
              <button key={label} onClick={onClick}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:border-border2 text-left w-full"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border1)', color: 'var(--text1)' }}>
                <Icon size={14} style={{ color: 'var(--accent)' }} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Activité récente (drum) ─────────────────────────────────── */}
          <div className="card" style={{ minHeight: 220 }}>
            <DrumActivity activites={activites} />
          </div>

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showLeadModal   && <LeadModal         onClose={() => setShowLeadModal(false)}   />}
      {showClientModal && <ClientModal       onClose={() => setShowClientModal(false)} />}
      {showProjetModal && <ProjetModal       onClose={() => setShowProjetModal(false)} />}
      {showImportModal && <ImportLeadsModal  onClose={() => setShowImportModal(false)} />}
    </div>
  )
}
