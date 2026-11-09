'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export function SectionTitle({
  eyebrow,
  title,
  action = 'Ver todos los productos',
  href = '/tienda',
  onClick,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow blue">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {onClick ? (
        <button type="button" className="text-link" onClick={onClick}>
          {action}
          <Icon name="arrow" size={19} />
        </button>
      ) : (
        <Link href={href} className="text-link">
          {action}
          <Icon name="arrow" size={19} />
        </Link>
      )}
    </div>
  );
}
