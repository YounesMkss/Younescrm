import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, BrandingConfig } from '@/types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  otpPending: boolean
  showSplash: boolean

  setOtpPending: (v: boolean) => void
  setShowSplash: (v: boolean) => void
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nom: string, role: string) => Promise<{ error: string | null; hasSession?: boolean }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithApple: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>
  updateBranding: (branding: BrandingConfig) => Promise<{ error: string | null }>
  acceptInvitation: (token: string) => Promise<{ error: string | null }>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      loading: false,
      initialized: false,
      otpPending: false,
      showSplash: false,

      setOtpPending: (v) => set({ otpPending: v }),
      setShowSplash: (v) => set({ showSplash: v }),

      initialize: async () => {
        set({ loading: true })
        try {
          // Détecter un retour OAuth (Google, Apple) avant que la session soit créée
          const isOAuthCallback =
            window.location.search.includes('code=') ||
            window.location.hash.includes('access_token=')

          const { data: { session } } = await supabase.auth.getSession()
          set({ session, user: session?.user ?? null })

          if (session?.user) {
            await get().fetchProfile()
            // Splash sur retour OAuth
            if (isOAuthCallback) {
              set({ showSplash: true })
            }
            // Traiter une invitation en attente (stockée après inscription)
            const pendingToken = localStorage.getItem('pending_invite_token')
            if (pendingToken) {
              localStorage.removeItem('pending_invite_token')
              await get().acceptInvitation(pendingToken)
            }
          }

          supabase.auth.onAuthStateChange(async (event, session) => {
            set({ session, user: session?.user ?? null })
            if (session?.user) {
              await get().fetchProfile()
              // Splash uniquement sur une vraie connexion sans OTP en attente
              // (si OTP pending, c'est Auth.tsx qui appellera setShowSplash après validation)
              if (event === 'SIGNED_IN' && !get().otpPending) {
                set({ showSplash: true })
              }
              // Traiter une invitation en attente
              const pendingToken = localStorage.getItem('pending_invite_token')
              if (pendingToken) {
                localStorage.removeItem('pending_invite_token')
                await get().acceptInvitation(pendingToken)
              }
            } else {
              set({ profile: null })
            }
          })
        } finally {
          set({ loading: false, initialized: true })
        }
      },

      signIn: async (email, password) => {
        set({ loading: true })
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) return { error: error.message }
          return { error: null }
        } finally {
          set({ loading: false })
        }
      },

      signUp: async (email, password, nom, role) => {
        set({ loading: true })
        try {
          const { data, error } = await supabase.auth.signUp({ email, password })
          if (error) return { error: error.message }
          if (data.user) {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              nom,
              role,
              avatar: '',
              branding: {},
            })
          }
          // Si Supabase renvoie une session directement (confirmation email désactivée)
          // on met à jour le state pour déclencher le redirect automatique
          if (data.session) {
            set({ session: data.session, user: data.user })
          }
          return { error: null, hasSession: !!data.session }
        } finally {
          set({ loading: false })
        }
      },

      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/` },
        })
        if (error) return { error: error.message }
        return { error: null }
      },

      signInWithApple: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: `${window.location.origin}/` },
        })
        if (error) return { error: error.message }
        return { error: null }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ session: null, user: null, profile: null })
      },

      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) return { error: error.message }
        return { error: null }
      },

      fetchProfile: async () => {
        const user = get().user
        if (!user) return

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data) {
          set({ profile: data as Profile })
        } else {
          // Auto-create profile on first login (e.g. Google OAuth)
          const nom = user.user_metadata?.full_name ?? user.email ?? 'Utilisateur'
          await supabase.from('profiles').upsert({
            id: user.id,
            nom,
            role: '',
            avatar: user.user_metadata?.avatar_url ?? '',
            branding: {},
          })
          await get().fetchProfile()
        }
      },

      updateProfile: async (data) => {
        const user = get().user
        if (!user) return { error: 'Non authentifié' }
        const { error } = await supabase
          .from('profiles')
          .update(data)
          .eq('id', user.id)
        if (error) return { error: error.message }
        await get().fetchProfile()
        return { error: null }
      },

      updateBranding: async (branding) => {
        const user = get().user
        if (!user) return { error: 'Non authentifié' }
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: user.id, branding })
        if (error) return { error: error.message }
        if (branding.accentColor) {
          localStorage.setItem('accent', branding.accentColor)
        }
        await get().fetchProfile()
        return { error: null }
      },

      acceptInvitation: async (token) => {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return { error: 'Non authentifié' }

        const { data: invite, error: fetchError } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .eq('status', 'pending')
          .single()

        if (fetchError || !invite) return { error: 'Invitation introuvable ou expirée' }

        // Vérifier que l'invitation est bien destinée à cet utilisateur
        const userEmail = user.email?.toLowerCase().trim()
        const inviteEmail = invite.to_email?.toLowerCase().trim()
        if (!userEmail || !inviteEmail || userEmail !== inviteEmail) {
          return { error: 'Cette invitation ne vous est pas destinée' }
        }

        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({ owner_id: invite.from_user_id, member_id: user.id, role: 'Membre' })

        if (memberError && !memberError.message.includes('duplicate')) {
          return { error: memberError.message }
        }

        await supabase
          .from('invitations')
          .update({ status: 'accepted' })
          .eq('id', invite.id)

        return { error: null }
      },
    }),
    {
      name: 'younes-crm-auth',
      partialize: (state) => ({ profile: state.profile }),
    }
  )
)
