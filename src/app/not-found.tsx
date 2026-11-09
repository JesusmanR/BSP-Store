'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  const router = useRouter();
  return (
    <div className="empty-state">
      <h1>Esta página aún no está en tu setup</h1>
      <Button onClick={() => router.push('/')}>Volver al inicio</Button>
    </div>
  );
}
