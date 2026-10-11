import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '@/lib/format';
import { useTracking } from '@/lib/tracking/use-tracking';
import { colors, spacing } from '@/theme';
import { Button, Card, ErrorBanner } from './ui';

/**
 * Passage « En service » / « Hors service ». La position du véhicule n'est
 * partagée qu'en service, et seulement après accord explicite du chauffeur.
 */
export function ServiceCard({ hasVehicle }: { hasVehicle: boolean }) {
  const tracking = useTracking();
  const onDuty = tracking.mode !== null;
  const { refresh } = tracking;

  // Retour sur l'écran (après l'écran de consentement) : état à jour immédiatement.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (tracking.loading) return null;

  return (
    <Card>
      <View style={styles.header}>
        <View
          style={[styles.dot, { backgroundColor: onDuty ? colors.success : colors.textFaint }]}
        />
        <Text style={styles.title}>{onDuty ? 'En service' : 'Hors service'}</Text>
      </View>

      {onDuty ? (
        <Text style={styles.text}>
          {tracking.mode === 'background'
            ? 'La position du véhicule est partagée avec votre gestionnaire, même écran éteint.'
            : 'La position est partagée tant que l’application reste ouverte.'}
          {'\n'}Dernier envoi : {timeAgo(tracking.lastSent)}
          {tracking.queued > 0 ? ` · ${tracking.queued} position(s) en attente de réseau` : ''}
        </Text>
      ) : (
        <Text style={styles.text}>
          {hasVehicle
            ? 'Passez en service au début de votre tournée pour que votre gestionnaire localise le véhicule.'
            : 'Aucun véhicule ne vous est affecté : le passage en service est indisponible.'}
        </Text>
      )}

      {onDuty && tracking.mode === 'foreground' && !tracking.backgroundSupported && (
        <View style={styles.note}>
          <Ionicons name="information-circle" size={16} color={colors.info} />
          <Text style={styles.noteText}>
            Version de test (Expo Go) : le suivi en arrière-plan nécessite l’application installée.
          </Text>
        </View>
      )}

      <ErrorBanner error={tracking.error} />

      {onDuty ? (
        <Button
          title="Terminer mon service"
          variant="secondary"
          icon="stop-circle"
          loading={tracking.busy}
          onPress={() => void tracking.stop()}
        />
      ) : (
        <Button
          title="Passer en service"
          icon="navigate"
          disabled={!hasVehicle}
          loading={tracking.busy}
          onPress={() =>
            tracking.consented ? void tracking.start() : router.push('/service-consent')
          }
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.infoSoft,
    padding: spacing.sm,
    borderRadius: 8,
  },
  noteText: { flex: 1, fontSize: 13, color: colors.info },
});
