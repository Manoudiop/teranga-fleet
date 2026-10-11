import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ServiceCard } from '@/components/service-card';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { formatKm } from '@/lib/format';
import { ALERT_SEVERITY, VEHICLE_STATUS } from '@/lib/labels';
import { useAlerts, useProfile } from '@/lib/queries';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  const profile = useProfile();
  const alerts = useAlerts();
  const vehicle = profile.data?.currentVehicle ?? null;
  // Les alertes « véhicule en maintenance » sont informatives : on garde l'essentiel.
  const important = (alerts.data ?? []).filter((a) => a.severity !== 'INFO');

  return (
    <Screen
      refreshing={profile.isRefetching || alerts.isRefetching}
      onRefresh={() => {
        void profile.refetch();
        void alerts.refetch();
      }}
    >
      {profile.data && <Text style={styles.hello}>Bonjour {profile.data.prenom}</Text>}

      {profile.isPending ? (
        <Loading />
      ) : profile.isError ? (
        <ErrorBanner error={profile.error} />
      ) : vehicle ? (
        <Link href="/my-vehicle" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mon véhicule ${vehicle.immatriculation}`}
          >
            <Card style={styles.vehicleCard}>
              <View style={styles.row}>
                <Text style={styles.label}>Mon véhicule</Text>
                <Badge tone={VEHICLE_STATUS[vehicle.statut]} />
              </View>
              <Text style={styles.plate}>{vehicle.immatriculation}</Text>
              <Text style={styles.model}>
                {vehicle.marque} {vehicle.modele}
              </Text>
              <View style={styles.row}>
                <View style={styles.km}>
                  <Ionicons name="speedometer-outline" size={18} color={colors.brandSoft} />
                  <Text style={styles.kmText}>{formatKm(vehicle.kilometrageActuel)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.brandSoft} />
              </View>
            </Card>
          </Pressable>
        </Link>
      ) : (
        <Card>
          <EmptyState
            icon="car-outline"
            title="Aucun véhicule affecté"
            description="Votre gestionnaire vous affectera un véhicule depuis le tableau de bord."
          />
        </Card>
      )}

      {profile.data && <ServiceCard hasVehicle={Boolean(vehicle)} />}

      {vehicle && (
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              title="Kilométrage"
              icon="speedometer"
              onPress={() => router.push('/mileage')}
            />
          </View>
          <View style={styles.action}>
            <Button
              title="Incident"
              icon="warning"
              variant="secondary"
              onPress={() => router.push('/incident-new')}
            />
          </View>
        </View>
      )}

      <SectionTitle>Alertes importantes</SectionTitle>
      {alerts.isPending ? (
        <Loading />
      ) : alerts.isError ? (
        <ErrorBanner error={alerts.error} />
      ) : important.length === 0 ? (
        <Card>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Tout est en ordre"
            description="Documents, permis et entretiens sont à jour."
          />
        </Card>
      ) : (
        important.map((alert) => (
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
  hello: { fontSize: 22, fontWeight: '700', color: colors.text },
  vehicleCard: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: { fontSize: 13, color: colors.brandSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  plate: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  model: { fontSize: 15, color: colors.brandSoft },
  km: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kmText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  alertTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  alertText: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
