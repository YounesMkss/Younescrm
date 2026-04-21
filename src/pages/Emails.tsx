import { useEffect, useState, useRef } from 'react'
import { useEmailStore } from '@/stores/emailStore'
import { useDataStore } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { getAvatarUrl } from '@/utils/avatar'
import {
  Send, Plus, Trash2, Inbox, Mail, Search,
  X, RefreshCw, Users, LogOut,
} from 'lucide-react'
import type { EmailMessage } from '@/types'

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function isBodyHtml(body: string) {
  return /<[a-z][\s\S]*>/i.test(body)
}

function groupByContact(messages: EmailMessage[]) {
  const map = new Map<string, { email: string; name: string; messages: EmailMessage[]; lastAt: string; unread: number }>()
  for (const m of messages) {
    const key = m.client_email.toLowerCase()
    if (!map.has(key)) map.set(key, { email: m.client_email, name: m.client_name || m.client_email, messages: [], lastAt: m.created_at, unread: 0 })
    const entry = map.get(key)!
    entry.messages.push(m)
    if (m.created_at > entry.lastAt) entry.lastAt = m.created_at
    if (!m.read && m.direction === 'received') entry.unread++
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

// ── Shared Gmail logo SVG ─────────────────────────────────────────────────────

function GmailLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ── Gmail connect screen ──────────────────────────────────────────────────────

function GmailConnectScreen() {
  const connectGmail = () => {
    const clientId    = import.meta.env.VITE_GMAIL_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/gmail/callback`
    const scope = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ')
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri,
      response_type: 'code', scope, access_type: 'offline', prompt: 'consent',
    })
  }

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">

      {/* ── Gauche : explication ── */}
      <div className="flex flex-col justify-center px-10 py-8 flex-1" style={{ maxWidth: 520 }}>
        <div className="flex flex-col gap-8">

          {/* Badge + titre */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 w-fit px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)' }}>
              <Mail size={12} /> Emails clients
            </div>
            <h1 className="font-syne font-bold text-2xl leading-snug" style={{ color: 'var(--text1)' }}>
              Ta boîte Gmail,<br />directement dans le CRM
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
              Connecte ton compte Google et gère toute ta communication client sans quitter l'app. Envoie, reçois, réponds — tout au même endroit.
            </p>
          </div>

          {/* Features */}
          <div className="flex flex-col gap-3">
            {[
              { icon: Send,     label: 'Envoie depuis ta vraie adresse Gmail',         desc: 'Tes clients reçoivent tes emails depuis ton adresse habituelle' },
              { icon: Inbox,    label: 'Reçois et lis tes emails ici',                 desc: 'Ta boîte de réception s\'affiche directement dans le CRM' },
              { icon: Users,    label: 'Conversations par client',                      desc: 'Chaque échange est lié automatiquement au bon contact' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4 px-4 py-3.5 rounded-2xl"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border1)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--accent)' }}>
                  <Icon size={16} color="#fff" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <button onClick={connectGmail}
              className="flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-md active:scale-95"
              style={{ background: '#fff', color: '#3c4043', border: '1px solid #dadce0', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
              <GmailLogo size={20} />
              Se connecter avec Google
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--text3)' }}>
              Connexion sécurisée OAuth 2.0 — déconnexion possible à tout moment
            </p>
          </div>
        </div>
      </div>

      {/* ── Droite : aperçu UI ── */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden"
        style={{ background: 'var(--surface2)', borderLeft: '1px solid var(--border1)' }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--surface1)', border: '1px solid var(--border1)' }}>

          {/* Faux topbar */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border1)' }}>
            <div className="flex items-center gap-2">
              <Inbox size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-syne font-bold text-xs" style={{ color: 'var(--text1)' }}>Messages</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}>3</span>
            </div>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Plus size={12} color="#fff" />
            </div>
          </div>

          {/* Fausses conversations */}
          {[
            { name: 'Marie Dupont', subject: 'Devis site web', time: '10min', unread: 2, sent: false },
            { name: 'Lucas Martin', subject: '↗ Proposition refonte', time: '1h', unread: 0, sent: true },
            { name: 'Sophie Bernard', subject: 'Suivi projet e-commerce', time: 'hier', unread: 1, sent: false },
          ].map((conv, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 cursor-default"
              style={{
                borderBottom: '1px solid var(--border1)',
                background: i === 0 ? 'rgba(59,130,246,0.08)' : 'transparent',
                borderLeft: i === 0 ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: ['#b6d9f7','#c9b8f0','#f7c5d0'][i], color: '#333' }}>
                  {conv.name[0]}
                </div>
                {conv.unread > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent)', border: '1.5px solid var(--surface1)' }}>
                    <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{conv.unread}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text1)' }}>{conv.name}</p>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text3)' }}>{conv.time}</span>
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: conv.unread > 0 ? 'var(--text2)' : 'var(--text3)', fontWeight: conv.unread > 0 ? 600 : 400 }}>
                  {conv.subject}
                </p>
              </div>
            </div>
          ))}

          {/* Faux thread */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <div className="flex gap-2 flex-row-reverse">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: '#c9b8f0' }} />
              <div className="rounded-2xl px-3 py-2 text-xs max-w-[70%]"
                style={{ background: 'var(--accent)', color: '#fff', borderRadius: '14px 14px 4px 14px' }}>
                Bonjour Marie, voici le devis...
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: '#b6d9f7' }} />
              <div className="rounded-2xl px-3 py-2 text-xs max-w-[70%]"
                style={{ background: 'var(--surface2)', color: 'var(--text1)', borderRadius: '14px 14px 14px 4px' }}>
                Parfait, merci beaucoup !
              </div>
            </div>
          </div>

          {/* Fausse barre de réponse */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border1)', color: 'var(--text3)' }}>
              <Send size={11} /> Écrire une réponse à Marie…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Compose modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  toEmail, toName, onClose, onSent,
  refreshToken, fromEmail, fromName, clientId,
}: {
  toEmail: string; toName: string; onClose: () => void; onSent: () => void
  refreshToken: string; fromEmail: string; fromName: string; clientId: string | null
}) {
  const { sendEmail, sending } = useEmailStore()
  const [to,      setTo]      = useState(toEmail)
  const [name,    setName]    = useState(toName)
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [error,   setError]   = useState('')

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error } = await sendEmail({ to, toName: name, clientId, subject, body, refreshToken, fromEmail, fromName })
    if (error) setError(error)
    else { onSent(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--surface1)', border: '1px solid var(--border1)', maxHeight: '90vh' }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border1)' }}>
          <h2 className="font-syne font-bold text-base text-text1">Nouveau message</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col gap-0" style={{ borderBottom: '1px solid var(--border1)' }}>
            <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border1)' }}>
              <span className="text-xs font-semibold w-12 flex-shrink-0" style={{ color: 'var(--text3)' }}>À</span>
              <input className="flex-1 bg-transparent text-sm text-text1 outline-none"
                placeholder="email@client.com" value={to}
                onChange={e => setTo(e.target.value)} required type="email" />
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs font-semibold w-12 flex-shrink-0" style={{ color: 'var(--text3)' }}>Objet</span>
              <input className="flex-1 bg-transparent text-sm text-text1 outline-none"
                placeholder="Objet du message" value={subject}
                onChange={e => setSubject(e.target.value)} required />
            </div>
          </div>

          <textarea
            className="flex-1 px-5 py-4 text-sm bg-transparent outline-none resize-none text-text1"
            placeholder="Écris ton message ici…"
            value={body} onChange={e => setBody(e.target.value)} required style={{ minHeight: 200 }}
          />

          {error && (
            <div className="mx-5 mb-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
              {error}
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border1)' }}>
            <span className="text-xs" style={{ color: 'var(--text3)' }}>
              De : <span style={{ color: 'var(--text2)' }}>{fromEmail || '—'}</span>
            </span>
            <button type="submit" disabled={sending} className="btn-primary gap-2">
              <Send size={14} />
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Emails() {
  const { messages, loading, fetchMessages, fetchGmailInbox, markAsRead, deleteMessage, subscribeRealtime } = useEmailStore()
  const { clients } = useDataStore()
  const { profile, updateProfile } = useAuthStore()

  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [composeTarget, setComposeTarget] = useState({ email: '', name: '', clientId: null as string | null })
  const threadEndRef = useRef<HTMLDivElement>(null)
  const [refreshToken, setRefreshToken] = useState('')

  const fromEmail    = profile?.branding?.gmailEmail ?? ''
  const fromName     = profile?.branding?.gmailName  ?? profile?.nom ?? ''
  const isConfigured = !!(refreshToken && fromEmail)

  // Charger le token depuis la table sécurisée (non exposée publiquement)
  useEffect(() => {
    const loadToken = async () => {
      const { data } = await supabase.from('user_tokens').select('gmail_refresh_token').single()
      if (data?.gmail_refresh_token) setRefreshToken(data.gmail_refresh_token)
    }
    loadToken()
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    fetchMessages()
    fetchGmailInbox(refreshToken)
    const unsub = subscribeRealtime()
    return unsub
  }, [isConfigured])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedEmail, messages.length])

  const conversations = groupByContact(messages)
  const filtered = search
    ? conversations.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()))
    : conversations

  const active = selectedEmail ? conversations.find(c => c.email === selectedEmail) : null
  const thread = active ? [...active.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)) : []

  useEffect(() => {
    if (!active) return
    active.messages.filter(m => !m.read && m.direction === 'received').forEach(m => markAsRead(m.id))
  }, [selectedEmail])

  const openCompose = (email = '', name = '', clientId: string | null = null) => {
    setComposeTarget({ email, name, clientId })
    setShowCompose(true)
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  // ── Setup prompt ──────────────────────────────────────────────────────────

  if (!isConfigured) {
    return <GmailConnectScreen />
  }

  // ── Layout email client ───────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-0 animate-fade-in overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── Colonne gauche ── */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 280, borderRight: '1px solid var(--border1)' }}>

        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border1)' }}>
          <div className="flex items-center gap-2">
            <Inbox size={15} style={{ color: 'var(--accent)' }} />
            <span className="font-syne font-bold text-sm text-text1">Messages</span>
            {totalUnread > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}>{totalUnread}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchGmailInbox(refreshToken)}
              className="w-9 h-9 flex items-center justify-center rounded-xl btn-ghost"
              title="Actualiser">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={async () => {
                await supabase.from('user_tokens').update({ gmail_refresh_token: null, gmail_email: null, gmail_name: null }).eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
                await updateProfile({ branding: { ...(profile?.branding ?? {}), gmailEmail: '', gmailName: '' } })
                setRefreshToken('')
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl btn-ghost"
              title="Déconnecter Gmail"
              style={{ color: 'var(--text3)' }}>
              <LogOut size={16} />
            </button>
            <button onClick={() => openCompose()}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border1)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--surface2)' }}>
            <Search size={12} style={{ color: 'var(--text3)' }} />
            <input className="flex-1 bg-transparent text-xs outline-none" style={{ color: 'var(--text1)' }}
              placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--accent)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Mail size={22} style={{ color: 'var(--border2)' }} />
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Aucun message</p>
            </div>
          ) : (
            filtered.map(conv => {
              const isActive = selectedEmail === conv.email
              const last = conv.messages.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
              return (
                <button key={conv.email}
                  onClick={() => setSelectedEmail(isActive ? null : conv.email)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                    borderBottom: '1px solid var(--border1)',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  }}>
                  <div className="relative flex-shrink-0">
                    <img src={getAvatarUrl(conv.name)} alt={conv.name}
                      className="w-9 h-9 rounded-full" style={{ background: 'var(--surface2)' }} />
                    {conv.unread > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)', border: '1.5px solid var(--surface1)' }}>
                        <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{conv.unread}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-text1 truncate">{conv.name}</p>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text3)' }}>{timeAgo(last.created_at)}</span>
                    </div>
                    <p className="text-xs truncate mt-0.5"
                      style={{ color: conv.unread > 0 ? 'var(--text2)' : 'var(--text3)', fontWeight: conv.unread > 0 ? 600 : 400 }}>
                      {last.direction === 'sent' ? '↗ ' : '↙ '}{last.subject}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Raccourcis clients */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border1)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>Contacter un client</p>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {clients.slice(0, 6).map(c => (
              <button key={c.id} onClick={() => openCompose('', c.nom, c.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all hover:bg-surface2 w-full"
                style={{ color: 'var(--text2)' }}>
                <img src={getAvatarUrl(c.nom)} alt={c.nom}
                  className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: 'var(--surface2)' }} />
                {c.nom}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Thread ── */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border1)' }}>
            <div className="flex items-center gap-3">
              <img src={getAvatarUrl(active.name)} alt={active.name}
                className="w-9 h-9 rounded-full" style={{ background: 'var(--surface2)' }} />
              <div>
                <p className="font-syne font-bold text-sm text-text1">{active.name}</p>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>{active.email}</p>
              </div>
            </div>
            <button onClick={() => openCompose(active.email, active.name, null)} className="btn-primary gap-2 text-xs">
              <Send size={12} /> Répondre
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {thread.map(msg => {
              const isSent = msg.direction === 'sent'
              return (
                <div key={msg.id} className={`flex gap-3 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img
                    src={isSent ? (profile?.avatar || getAvatarUrl(profile?.nom || 'user')) : getAvatarUrl(active.name)}
                    alt="" className="w-8 h-8 rounded-full flex-shrink-0 mt-1"
                    style={{ background: 'var(--surface2)' }}
                  />
                  <div className={`${isBodyHtml(msg.body) && !isSent ? 'w-full' : 'max-w-[85%]'} flex flex-col gap-1 ${isSent ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text3)' }}>{timeAgo(msg.created_at)}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>{msg.subject}</span>
                    </div>
                    <div className="overflow-hidden text-sm w-full"
                      style={{
                        background: isSent ? 'var(--accent)' : 'var(--surface2)',
                        borderRadius: isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}>
                      {isBodyHtml(msg.body) ? (
                        <iframe
                          srcDoc={msg.body}
                          sandbox="allow-same-origin"
                          className="w-full border-0"
                          style={{ minHeight: 200, height: 'auto' }}
                          onLoad={e => {
                            const f = e.currentTarget
                            const h = f.contentDocument?.documentElement?.scrollHeight
                              ?? f.contentDocument?.body?.scrollHeight
                              ?? 400
                            f.style.height = Math.min(h + 20, 800) + 'px'
                          }}
                        />
                      ) : (
                        <div className="px-4 py-3 leading-relaxed" style={{ color: isSent ? '#fff' : 'var(--text1)' }}>
                          {msg.body.split('\n').map((line, i) => <p key={i}>{line || <br />}</p>)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteMessage(msg.id)}
                      className="opacity-0 hover:opacity-100 transition-opacity p-1" style={{ color: 'var(--text3)' }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
            <div ref={threadEndRef} />
          </div>

          <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border1)' }}>
            <button onClick={() => openCompose(active.email, active.name, null)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border1)', color: 'var(--text3)' }}>
              <Send size={13} />
              Écrire une réponse à {active.name}…
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: 'var(--text3)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
            <Mail size={28} style={{ color: 'var(--border2)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-text1">Sélectionne une conversation</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>ou compose un nouveau message</p>
          </div>
          <button onClick={() => openCompose()} className="btn-primary gap-2">
            <Plus size={14} /> Nouveau message
          </button>
        </div>
      )}

      {showCompose && (
        <ComposeModal
          toEmail={composeTarget.email}
          toName={composeTarget.name}
          clientId={composeTarget.clientId}
          refreshToken={refreshToken}
          fromEmail={fromEmail}
          fromName={fromName}
          onClose={() => setShowCompose(false)}
          onSent={() => fetchMessages()}
        />
      )}
    </div>
  )
}
