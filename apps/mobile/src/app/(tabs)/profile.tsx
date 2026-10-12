import { router } from 'expo-router';
import { Alert, StyleSheet, Text } from 'react-native';
import { ServiceCard } from '@/components/service-card';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  InfoRow,
  Loading,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { EXPIRY_STATUS } from '@/lib/labels';
import { useProfile } from '@/lib/queries';
import { useTracking } from '@/lib/tracking/use-tracking';
import { colors } from '@/theme';

export default function ProfileScreen() {
  const { state, signOut } = useAuth();
  const profile = useProfile();
  const tracking = useTracking();

  function confirmSignOut() {
    Alert.alert('Se déconnecter ?', 'Si vous êtes en service, le partage de position s’arrêtera.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  function confirmWithdraw() {
    Alert.alert(
      'Retirer votre accord ?',
      'Le partage de position s’arrête. Il vous sera redemandé au prochain passage en service.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => void tracking.withdraw() },
      ],
    );
  }

  if (profile.isPending) return <Loading />;

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <ErrorBanner error={profile.error} />
      {profile.data && (
        <>
          <Card>
            <Text style={styles.name}>
              {profile.data.prenom} {profile.data.nom}
            </Text>
            <Text style={styles.meta}>{state.status === 'signedIn' ? state.user.email : ''}</Text>
            <InfoRow
              label="Entreprise"
              value={state.status === 'signedIn' ? (state.user.company?.nom ?? '—') : '—'}
            />
            <InfoRow label="Téléphone" value={profile.data.contact ?? '—'} />
          </Card>

          <SectionTitle>Permis de conduire</SectionTitle>
          <Card>
            <InfoRow label="Numéro" value={profile.data.numeroPermis} />
            <InfoRow label="Expiration" value={formatDate(profile.data.dateExpirationPermis)} />
            <InfoRow
              label="Statut"
              value={<Badge tone={EXPIRY_STATUS[profile.data.permisStatus]} />}
            />
          </Card>

          <SectionTitle>Service et position</SectionTitle>
          <ServiceCard hasVehicle={Boolean(profile.data.currentVehicle)} />
          {tracking.consented && (
            <Button
              title="Retirer mon accord de partage de position"
              variant="secondary"
              onPress={confirmWithdraw}
            />
          )}
        </>
      )}
      <Button
        title="Changer mon mot de passe"
        variant="secondary"
        icon="key-outline"
        onPress={() => router.push('/password')}
      />
      <Button
        title="Se déconnecter"
        variant="danger"
        icon="log-out-outline"
        onPress={confirmSignOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted },
});
