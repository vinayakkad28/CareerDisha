"use client";

import Link from "next/link";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface Props {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  subtitle?: string;
}

export default function PageHeader({ title, breadcrumbs, actions, subtitle }: Props) {
  return (
    <div className="mb-10">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm text-on-surface-variant/60 mb-3">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg className="w-3.5 h-3.5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-primary transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-on-surface-variant">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-primary tracking-tight">{title}</h1>
          {subtitle && <p className="text-on-surface-variant font-medium mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-4">{actions}</div>}
      </div>
    </div>
  );
}
