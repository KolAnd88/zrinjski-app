import { useLayoutEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { supabase } from '../lib/supabase';
import { C, F, R, SP } from '../theme';
import { Screen, Txt } from '../components/base';
import { PrimaryButton } from '../components/buttons';
import type { RootStackParamList } from '../navigation/types';

/**
 * Otvaranje računa predstavnika kluba iz mobilne app.
 * Račun dobiva ulogu 'rep' bez ekipe; ekipa se prijavljuje iznutra i čeka
 * odobrenje organizatora.
 */
export function SignupScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({ title: t('signup.title') });
  }, [nav, t]);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function submit() {
    if (!supabase || !canSubmit) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Bez sesije znači da Supabase traži potvrdu e-maila prije prijave.
    if (!data.session) {
      setSent(true);
      return;
    }
    nav.replace('MyTeam');
  }

  if (sent) {
    return (
      <Screen>
        <Txt variant="h1">{t('signup.checkMailTitle')}</Txt>
        <Txt style={styles.hint}>{t('signup.checkMailBody', { e: email.trim() })}</Txt>
        <PrimaryButton
          label={t('signup.toLogin')}
          style={{ marginTop: SP.section }}
          onPress={() => nav.replace('AdminLogin')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt style={styles.hint}>{t('signup.intro')}</Txt>
      {err && <Txt style={styles.err}>{err}</Txt>}

      <Txt style={styles.label}>{t('admin.email')}</Txt>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="klub@primjer.ba"
        placeholderTextColor={C.mut}
      />

      <Txt style={styles.label}>{t('admin.password')}</Txt>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="min. 6 znakova"
        placeholderTextColor={C.mut}
      />

      <PrimaryButton
        label={busy ? t('signup.creating') : t('signup.submit')}
        disabled={busy || !canSubmit}
        style={{ marginTop: SP.section }}
        onPress={() => void submit()}
      />

      <View style={{ alignItems: 'center', marginTop: SP.cardGap }}>
        <Txt style={styles.hint} onPress={() => nav.replace('AdminLogin')}>
          {t('signup.haveAccount')}
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: F.body, fontSize: 13, color: C.sub, marginTop: SP.gap, lineHeight: 19 },
  err: { fontFamily: F.body, fontSize: 13, color: C.redLt, marginTop: SP.gap },
  label: {
    fontFamily: F.headSemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.sub,
    marginTop: SP.cardGap,
    marginBottom: SP.hair,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    paddingHorizontal: SP.rowY,
    paddingVertical: 12,
    color: C.txt,
    fontFamily: F.body,
    fontSize: 15,
    minHeight: 48,
  },
});
