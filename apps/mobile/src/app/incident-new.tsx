import type { IncidentSeverity, IncidentType } from '@teranga-fleet/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, ChoiceChips, ErrorBanner, Screen, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { INCIDENT_SEVERITY, INCIDENT_TYPE } from '@/lib/labels';
import { keys } from '@/lib/queries';
import { colors, radius, spacing } from '@/theme';

const TYPE_OPTIONS = (Object.keys(INCIDENT_TYPE) as IncidentType[]).map((value) => ({
  value,
  label: INCIDENT_TYPE[value],
}));
const SEVERITY_OPTIONS = (Object.keys(INCIDENT_SEVERITY) as IncidentSeverity[]).map((value) => ({
  value,
  label: INCIDENT_SEVERITY[value].label,
}));

/** Photo compressée : suffisante pour un constat, légère à envoyer sur réseau mobile. */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };

export default function NewIncidentScreen() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<IncidentType>('PANNE');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [descriptionError, setDescriptionError] = useState<string>();
  const [pickerError, setPickerError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setPickerError(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError(
        source === 'camera'
          ? "Autorisez l'accès à l'appareil photo dans les réglages du téléphone."
          : "Autorisez l'accès aux photos dans les réglages du téléphone.",
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('type', type);
      form.append('severity', severity);
      form.append('description', description.trim());
      if (photo) {
        const isPng = photo.mimeType === 'image/png' || photo.uri.toLowerCase().endsWith('.png');
        // Format fichier attendu par React Native pour un envoi multipart.
        form.append('photo', {
          uri: photo.uri,
          name: isPng ? 'incident.png' : 'incident.jpg',
          type: isPng ? 'image/png' : 'image/jpeg',
        } as unknown as Blob);
      }
      return api('incidents', { method: 'POST', body: form });
    },
    onSuccess: async () => {
      await Promise.all(
        [keys.incidents, keys.alerts].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      Alert.alert('Incident signalé', 'Votre gestionnaire a été informé.');
      router.back();
    },
  });

  function submit() {
    const text = description.trim();
    setDescriptionError(text.length < 3 ? 'Décrivez ce qui s’est passé' : undefined);
    if (text.length >= 3) send.mutate();
  }

  return (
    <Screen>
      <ErrorBanner error={send.error ?? pickerError} />
      <ChoiceChips label="Type d'incident" options={TYPE_OPTIONS} value={type} onChange={setType} />
      <ChoiceChips
        label="Gravité"
        options={SEVERITY_OPTIONS}
        value={severity}
        onChange={setSeverity}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        style={styles.textarea}
        placeholder="Où, quand, ce qui s'est passé…"
        error={descriptionError}
      />
      {photo ? (
        <View style={styles.photoBlock}>
          <Image
            source={{ uri: photo.uri }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel="Photo de l'incident"
          />
          <Button
            title="Retirer la photo"
            variant="danger"
            icon="trash"
            onPress={() => setPhoto(null)}
          />
        </View>
      ) : (
        <View style={styles.photoActions}>
          <View style={styles.flex}>
            <Button
              title="Prendre une photo"
              variant="secondary"
              icon="camera"
              onPress={() => void pick('camera')}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Galerie"
              variant="secondary"
              icon="images"
              onPress={() => void pick('library')}
            />
          </View>
        </View>
      )}
      <Button
        title="Envoyer le signalement"
        icon="send"
        loading={send.isPending}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  textarea: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  photoBlock: { gap: spacing.md },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  photoActions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
