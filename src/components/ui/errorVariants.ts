import type { errorStateIcons } from './errorStateIcons'

type Variant = { title: string; message?: string; icon?: keyof typeof errorStateIcons; action?: { label: string; onClick?: () => void; href?: string } }

export const errorVariants = {
  accessDenied: (onHome?: () => void): Variant => ({
    icon: 'lock', title: 'velvet rope ahead',
    message: 'these administration screens are super-admins only — the bouncer was very firm about it',
    action: onHome ? { label: 'go to darpan', onClick: onHome } : { label: 'go to darpan', href: '/' },
  }),
  serverError: (onRetry: () => void): Variant => ({
    icon: 'alert', title: 'well, that was not supposed to happen', message: 'something tripped over a cable. we are pretending it was not us',
    action: { label: 'try again', onClick: onRetry },
  }),
  sessionExpired: (onSignIn: () => void): Variant => ({
    icon: 'clock', title: 'your session dozed off', message: 'sign in to wake it up',
    action: { label: 'sign in', onClick: onSignIn },
  }),
  notFound: (onHome?: () => void): Variant => ({
    title: 'this page is on a coffee break', message: 'it moved, never existed, or is still out to lunch',
    action: onHome ? { label: 'back to home', onClick: onHome } : { label: 'back to home', href: '/' },
  }),
}
