/**
 * A light stand-in for the host's `@kirocrew/app-sdk/ui`: plain elements with
 * the roles, labels and test ids the host components render, so a test can find
 * them the way a user would.
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'


export function Btn({ primary: _primary, danger: _danger, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean }) {
  return <button type={type} {...rest} />
}

export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...rest}>{children}</div>
}

export function Badge({ children, variant, className, ...rest }: { children?: ReactNode; variant?: string; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  return <span data-testid="badge" {...rest} data-variant={variant} className={className}>{children}</span>
}

export function EmptyState({ title, testId = 'empty-state' }: { icon: ReactNode; title: string; testId?: string }) {
  return <div data-testid={testId}><div data-testid={`${testId}-title`}>{title}</div></div>
}

export function PageHeader({ title, subtitle }: { title: ReactNode; subtitle?: string }) {
  return <header><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</header>
}

export function ErrorNotice({ message }: { message?: string | null }) {
  return message ? <div role="alert">{message}</div> : null
}
