import { redirect } from 'next/navigation';

// La racine mène au tableau de bord (proxy.ts redirige vers /login sans session).
export default function Home() {
  redirect('/dashboard');
}
