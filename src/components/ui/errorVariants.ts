import type { IconName } from '../../lib/icons'

/** The icons a blocking error state draws. */
export type StateIconName = Extract<IconName, 'lock' | 'alert' | 'clock' | 'offline'>

type Variant = { title: string; message?: string; icon?: StateIconName; action?: { label: string; onClick?: () => void; href?: string } }

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
    title: 'this page wandered off', message: 'it moved or never existed. we checked behind the couch',
    action: onHome ? { label: 'back to home', onClick: onHome } : { label: 'back to home', href: '/' },
  }),
}
