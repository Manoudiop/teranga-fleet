import type { PaginatedResponse } from '@teranga-fleet/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { Incident } from '@/lib/types';
import { colors, spacing } from '@/theme';

export default function IncidentsScreen() {
  const incidents = useQuery({
    queryKey: keys.incidents,
    queryFn: () => api<PaginatedResponse<Incident>>('incidents', { query: { limit: 50 } }),
  });

  return (
    <Screen refreshing={incidents.isRefetching} onRefresh={() => void incidents.refetch()}>
      <Button
        title="Signaler un incident"
        icon="add-circle"
        onPress={() => router.push('/incident-new')}
      />
      {incidents.isPending ? (
        <Loading />
      ) : incidents.isError ? (
        <ErrorBanner error={incidents.error} />
      ) : incidents.data.data.length === 0 ? (
        <Card>
          <EmptyState icon="shield-checkmark-outline" title="Aucun incident signalé" />
        </Card>
      ) : (
        incidents.data.data.map((i) => (
          <Card key={i.id}>
            <View style={styles.row}>
              <Text style={styles.type}>{INCIDENT_TYPE[i.type]}</Text>
              <Badge tone={INCIDENT_STATUS[i.status]} />
            </View>
            <Text style={styles.meta}>
              {i.vehicle.immatriculation} · {formatDateTime(i.createdAt)}
            </Text>
            <Text style={styles.description}>{i.description}</Text>
            <View style={styles.row}>
              <Badge tone={INCIDENT_SEVERITY[i.severity]} />
              {i.hasPhoto && <Text style={styles.meta}>Photo jointe</Text>}
            </View>
            {i.notesGestionnaire && (
              <View style={styles.notes}>
                <Text style={styles.notesLabel}>Réponse du gestionnaire</Text>
                <Text style={styles.description}>{i.notesGestionnaire}</Text>
              </View>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  type: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  description: { fontSize: 15, lineHeight: 21, color: colors.text },
  notes: { backgroundColor: colors.background, borderRadius: 8, padding: spacing.md, gap: 4 },
  notesLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});
