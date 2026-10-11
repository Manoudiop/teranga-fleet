import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { formatKm } from '@/lib/format';
import { keys, useProfile } from '@/lib/queries';
import { colors } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

/** « 11/10/2026 18:30 » dans le fuseau du téléphone. */
function nowText(): string {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** JJ/MM/AAAA HH:MM (heure locale) → Date, ou null si invalide. */
function parseDateTime(text: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m.map(Number);
  const date = new Date(yyyy, mm - 1, dd, hh, min);
  return date.getMonth() === mm - 1 && date.getDate() === dd ? date : null;
}

export default function MileageScreen() {
  const queryClient = useQueryClient();
  const profile = useProfile();
  const vehicle = profile.data?.currentVehicle;
  const [km, setKm] = useState('');
  const [when, setWhen] = useState(nowText);
  const [errors, setErrors] = useState<{ km?: string; when?: string }>({});

  const save = useMutation({
    mutationFn: (body: { kilometrage: number; date: string }) =>
      api('mileage', { method: 'POST', body: { ...body, vehicleId: vehicle!.id } }),
    onSuccess: async (_data, body) => {
      await Promise.all(
        [keys.profile, keys.mileage, keys.alerts].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      setKm('');
      setWhen(nowText());
      Alert.alert('Relevé enregistré', `Compteur : ${formatKm(body.kilometrage)}`);
    },
  });

  function submit() {
    if (!vehicle) return;
    const value = Number(km.replace(/\s/g, ''));
    const date = parseDateTime(when);
    const next = {
      // Validation identique à celle de l'API, pour un retour immédiat.
      km: !/^\d+$/.test(km.replace(/\s/g, ''))
        ? 'Indiquez le kilométrage affiché au compteur'
        : value < vehicle.kilometrageActuel
          ? `Ne peut pas être inférieur au dernier relevé (${formatKm(vehicle.kilometrageActuel)})`
          : undefined,
      when: !date
        ? 'Format attendu : JJ/MM/AAAA HH:MM'
        : date.getTime() > Date.now() + 5 * 60_000
          ? 'La date ne peut pas être dans le futur'
          : undefined,
    };
    setErrors(next);
    if (next.km || next.when) return;
    save.mutate({ kilometrage: value, date: date!.toISOString() });
  }

  if (profile.isPending) return <Loading />;
  if (!vehicle) {
    return (
      <Screen>
        <ErrorBanner error={profile.error} />
        <Card>
          <EmptyState
            icon="car-outline"
            title="Aucun véhicule affecté"
            description="La saisie du kilométrage nécessite un véhicule affecté."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.vehicle}>{vehicle.immatriculation}</Text>
        <Text style={styles.current}>Dernier relevé : {formatKm(vehicle.kilometrageActuel)}</Text>
      </Card>
      <ErrorBanner error={save.error} />
      <TextField
        label="Kilométrage au compteur"
        value={km}
        onChangeText={setKm}
        keyboardType="number-pad"
        placeholder={String(vehicle.kilometrageActuel)}
        error={errors.km}
      />
      <TextField
        label="Date et heure du relevé"
        value={when}
        onChangeText={setWhen}
        keyboardType="numbers-and-punctuation"
        error={errors.when}
        hint="Laissez l'heure actuelle si vous relevez le compteur maintenant"
      />
      <Button
        title="Enregistrer le relevé"
        icon="checkmark"
        loading={save.isPending}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicle: { fontSize: 20, fontWeight: '700', color: colors.text },
  current: { fontSize: 15, color: colors.textMuted },
});
