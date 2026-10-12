import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, ErrorBanner, Screen, TextField } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

interface Errors {
  current?: string;
  next?: string;
  confirmation?: string;
}

/** Même règle que l'API : 8 caractères, une lettre et un chiffre. */
function passwordProblem(value: string): string | undefined {
  if (value.length < 8) return 'Au moins 8 caractères';
  if (value.length > 128) return 'Au plus 128 caractères';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Au moins une lettre et un chiffre';
  return undefined;
}

export default function PasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const save = useMutation({
    mutationFn: () =>
      api('auth/password', {
        method: 'PUT',
        body: { currentPassword: current, newPassword: next },
      }),
    onSuccess: () => {
      Alert.alert('Mot de passe modifié', 'Utilisez-le à votre prochaine connexion.');
      router.back();
    },
    onError: (error) => {
      // Les erreurs rattachées à un champ s'affichent sous celui-ci plutôt qu'en bandeau.
      if (!(error instanceof ApiError)) return;
      if (error.code === 'INVALID_CREDENTIALS') setErrors({ current: error.message });
      else if (error.details?.newPassword) setErrors({ next: error.details.newPassword[0] });
    },
  });

  function submit() {
    const found: Errors = {
      current: current ? undefined : 'Le mot de passe actuel est obligatoire',
      next: passwordProblem(next),
      confirmation:
        confirmation === next ? undefined : 'Les deux mots de passe ne correspondent pas',
    };
    setErrors(found);
    if (found.current || found.next || found.confirmation) return;
    save.mutate();
  }

  const fieldError = Object.values(errors).some(Boolean);

  return (
    <Screen>
      <ErrorBanner error={save.isError && !fieldError ? save.error : null} />
      <TextField
        label="Mot de passe actuel"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        onSubmitEditing={submit}
        autoComplete="current-password"
        textContentType="password"
        error={errors.current}
      />
      <TextField
        label="Nouveau mot de passe"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        onSubmitEditing={submit}
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.next}
        hint="8 caractères, une lettre et un chiffre"
      />
      <TextField
        label="Confirmation"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        onSubmitEditing={submit}
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.confirmation}
      />
      <Button
        title="Changer le mot de passe"
        icon="key-outline"
        loading={save.isPending}
        onPress={submit}
      />
    </Screen>
  );
}
