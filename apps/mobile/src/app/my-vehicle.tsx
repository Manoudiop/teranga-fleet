import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  InfoRow,
  Loading,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { formatDateTime, formatKm } from '@/lib/format';
import { ALERT_SEVERITY, VEHICLE_STATUS } from '@/lib/labels';
import { useAlerts, useProfile } from '@/lib/queries';
import { colors } from '@/theme';

export default function MyVehicleScreen() {
  const profile = useProfile();
  const alerts = useAlerts();
  const vehicle = profile.data?.currentVehicle;
  const vehicleAlerts = (alerts.data ?? []).filter((a) => vehicle && a.vehicleId === vehicle.id);

  if (profile.isPending) return <Loading />;
  if (profile.isError) {
    return (
      <Screen>
        <ErrorBanner error={profile.error} />
      </Screen>
    );
  }
  if (!vehicle) {
    return (
      <Screen>
        <Card>
          <EmptyState icon="car-outline" title="Aucun véhicule affecté" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={profile.isRefetching}
      onRefresh={() => {
        void profile.refetch();
        void alerts.refetch();
      }}
    >
      <View>
        <Text style={styles.plate}>{vehicle.immatriculation}</Text>
        <Text style={styles.model}>
          {vehicle.marque} {vehicle.modele}
        </Text>
      </View>
      <Card>
        <InfoRow label="Statut" value={<Badge tone={VEHICLE_STATUS[vehicle.statut]} />} />
        <InfoRow label="Kilométrage" value={formatKm(vehicle.kilometrageActuel)} />
        <InfoRow
          label="Affecté depuis"
          value={formatDateTime(profile.data.currentAssignment?.dateDebut)}
        />
      </Card>

      <SectionTitle>Documents et entretiens</SectionTitle>
      {vehicleAlerts.length === 0 ? (
        <Card>
          <EmptyState
            icon="shield-checkmark-outline"
            title="Rien à signaler"
            description="Assurance, visite technique, vignette et entretiens sont à jour."
          />
        </Card>
      ) : (
        vehicleAlerts.map((alert) => (
          <Card key={alert.id}>
            <View style={styles.row}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Badge tone={ALERT_SEVERITY[alert.severity]} />
            </View>
            <Text style={styles.alertText}>{alert.message}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: 1 },
  model: { fontSize: 16, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  alertTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  alertText: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
