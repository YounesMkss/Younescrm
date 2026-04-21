import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

const GMAIL_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail`

export default function GmailCallback() {
  const navigate = useNavigate()
  const { profile, updateProfile } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const code  = params.get('code')
      const error = params.get('error')

      if (error || !code) {
        setStatus('error')
        setMessage(error === 'access_denied' ? 'Autorisation refusée.' : 'Code manquant.')
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const redirectUri = `${window.location.origin}/auth/gmail/callback`

        const res = await fetch(GMAIL_FN, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'exchange', code, redirectUri }),
        })

        const json = await res.json()
        if (json.error) throw new Error(json.error)

        // Get Gmail profile info
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${json.access_token}` },
        })
        const userInfo = await profileRes.json()

        // Store token in secure table (not visible to other users)
        await supabase.from('user_tokens').upsert({
          user_id: session?.user?.id,
          gmail_refresh_token: json.refresh_token,
          gmail_email: userInfo.email ?? '',
          gmail_name: userInfo.name ?? '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        // Only store non-sensitive info in profile branding
        const branding = {
          ...(profile?.branding ?? {}),
          gmailEmail: userInfo.email ?? '',
          gmailName: userInfo.name ?? '',
        }
        await updateProfile({ branding })

        setStatus('success')
        setMessage(`Gmail connecté : ${userInfo.email}`)
        setTimeout(() => navigate('/emails'), 1500)
      } catch (e: any) {
        setStatus('error')
        setMessage(e.message ?? 'Erreur inconnue')
      }
    }

    run()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface1)' }}>
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--text2)' }}>Connexion Gmail en cours…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} style={{ color: '#10B981' }} />
            <p className="font-semibold" style={{ color: 'var(--text1)' }}>{message}</p>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>Redirection vers les emails…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} style={{ color: '#EF4444' }} />
            <p className="font-semibold" style={{ color: 'var(--text1)' }}>Connexion échouée</p>
            <p className="text-sm" style={{ color: '#EF4444' }}>{message}</p>
            <button
              onClick={() => navigate('/parametres')}
              className="btn-primary mt-2"
            >
              Retour
            </button>
          </>
        )}
      </div>
    </div>
  )
}
