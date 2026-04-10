'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DSARootPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dsa/dashboard'); }, [router]);
  return null;
}
