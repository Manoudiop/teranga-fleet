import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorBanner, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const next = {
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : 'Adresse email invalide',
      password: password ? undefined : 'Le mot de passe est obligatoire',
    };
    setErrors(next);
    if (next.email || next.password) return;

    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const reason = state.status === 'signedOut' ? state.reason : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="car-sport" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Teranga Fleet</Text>
          <Text style={styles.subtitle}>Espace chauffeur</Text>
        </View>

        <View style={styles.form}>
          <ErrorBanner error={error ?? reason} />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          <Button title="Se connecter" onPress={() => void submit()} loading={loading} />
          <Text style={styles.help}>Identifiants fournis par votre gestionnaire de flotte.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl * 1.5 },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: { backgroundColor: colors.brandDark, borderRadius: 16, padding: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  form: { gap: spacing.lg },
  help: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
