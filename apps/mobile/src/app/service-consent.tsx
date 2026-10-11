import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBanner, Screen } from '@/components/ui';
import { useTracking } from '@/lib/tracking/use-tracking';
import { colors, spacing } from '@/theme';

const POINTS: { icon: 'navigate' | 'time' | 'eye' | 'trash' | 'hand-left'; text: string }[] = [
  {
    icon: 'navigate',
    text: 'La position du véhicule qui vous est affecté est envoyée environ toutes les minutes pendant que vous roulez.',
  },
  {
    icon: 'time',
    text: 'Uniquement pendant votre service : rien n’est envoyé quand vous êtes « Hors service ».',
  },
  { icon: 'eye', text: 'Seuls les gestionnaires de votre entreprise voient ces positions.' },
  { icon: 'trash', text: 'Les positions sont supprimées automatiquement après 90 jours.' },
  {
    icon: 'hand-left',
    text: 'Vous pouvez retirer votre accord à tout moment depuis votre profil.',
  },
];

/** Information et consentement préalables au partage de position (donnée personnelle). */
export default function ServiceConsentScreen() {
  const tracking = useTracking();

  return (
    <Screen>
      <Text style={styles.title}>Partage de la position du véhicule</Text>
      <Card>
        {POINTS.map((p) => (
          <View key={p.icon} style={styles.point}>
            <Ionicons name={p.icon} size={20} color={colors.brand} />
            <Text style={styles.text}>{p.text}</Text>
          </View>
        ))}
      </Card>
      <Text style={styles.note}>
        Le téléphone vous demandera ensuite l’autorisation d’accéder à la position. Choisissez «
        Toujours autoriser » pour que le suivi continue écran éteint ; une notification reste
        visible pendant le service.
      </Text>
      <ErrorBanner error={tracking.error} />
      <Button
        title="J’accepte et je passe en service"
        icon="checkmark"
        loading={tracking.busy}
        onPress={async () => {
          if (await tracking.accept()) router.back();
        }}
      />
      <Button title="Refuser" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  text: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
  note: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
});
