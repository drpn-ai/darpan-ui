import type { errorStateIcons } from './errorStateIcons'

type Variant = { title: string; message?: string; icon?: keyof typeof errorStateIcons; action?: { label: string; onClick?: () => void; href?: string } }

export const errorVariants = {
  accessDenied: (onHome?: () => void): Variant => ({
    icon: 'lock', title: 'super-admin access required',
    message: 'these administration screens are limited to super-admin users — head back to the app to keep working',
    action: onHome ? { label: 'go to darpan', onClick: onHome } : { label: 'go to darpan', href: '/' },
  }),
  serverError: (onRetry: () => void): Variant => ({
    icon: 'alert', title: 'something went wrong', message: 'we hit an unexpected error',
    action: { label: 'try again', onClick: onRetry },
  }),
  sessionExpired: (onSignIn: () => void): Variant => ({
    icon: 'clock', title: 'your session ended', message: 'please sign in to continue',
    action: { label: 'sign in', onClick: onSignIn },
  }),
  notFound: (onHome?: () => void): Variant => ({
    title: 'page not found', message: "that page doesn't exist or has moved",
    action: onHome ? { label: 'back to home', onClick: onHome } : { label: 'back to home', href: '/' },
  }),
}
