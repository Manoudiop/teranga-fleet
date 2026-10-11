import { Redirect } from 'expo-router';

/** Entrée de l'application (protégée) : l'accueil. Hors session, le garde renvoie vers /login. */
export default function Index() {
  return <Redirect href="/home" />;
}
