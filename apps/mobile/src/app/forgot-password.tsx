import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Card, ErrorBanner, Screen, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();

  const send = useMutation({
    mutationFn: (address: string) =>
      api('auth/forgot-password', { method: 'POST', body: { email: address }, token: null }),
  });

  function submit() {
    const address = email.trim().toLowerCase();
    const invalid = /^\S+@\S+\.\S+$/.test(address) ? undefined : 'Adresse email invalide';
    setError(invalid);
    if (!invalid) send.mutate(address);
  }

  if (send.isSuccess) {
    return (
      <Screen>
        <Card>
          {/* Même message que le compte existe ou non : on ne révèle pas les comptes existants. */}
          <Text style={styles.title}>Vérifiez vos emails</Text>
          <Text style={styles.text}>
            Si un compte existe pour {send.variables}, un email vient de lui être envoyé. Ouvrez le
            lien sur ce téléphone, choisissez un nouveau mot de passe, puis revenez vous connecter.
            Le lien est valable une heure.
          </Text>
        </Card>
        <Button title="Retour à la connexion" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.text}>
        Indiquez l’email de votre compte : vous recevrez un lien pour choisir un nouveau mot de
        passe.
      </Text>
      <ErrorBanner error={send.error} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button
        title="Recevoir le lien"
        icon="mail-outline"
        loading={send.isPending}
        onPress={submit}
      />
      <Text style={styles.help}>
        Rien reçu (adresse inexacte, boîte inaccessible) ? Demandez à votre gestionnaire de vous
        définir un nouveau mot de passe.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  help: { fontSize: 13, color: colors.textMuted },
});
