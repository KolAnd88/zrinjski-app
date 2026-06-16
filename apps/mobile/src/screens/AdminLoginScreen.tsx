import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useT } from '../i18n/I18nProvider';
import { C, F, R, S } from '../theme';
import { Screen, Txt } from '../components/base';
import { PrimaryButton } from '../components/buttons';
import type { RootStackParamList } from '../navigation/types';

export function AdminLoginScreen() {
  const { t } = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Txt style={styles.logoTxt}>ZRI</Txt>
        </View>
        <Txt variant="h1" style={{ textAlign: 'center' }}>
          {t('appName')}
        </Txt>
        <Txt variant="label" color={C.red} style={{ textAlign: 'center', marginTop: 4 }}>
          {t('admin.login')}
        </Txt>
      </View>

      <Txt variant="label" style={styles.lbl}>
        {t('admin.email')}
      </Txt>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="delegat@zrinjski.ba"
        placeholderTextColor={C.mut}
      />

      <Txt variant="label" style={styles.lbl}>
        {t('admin.password')}
      </Txt>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={C.mut}
      />

      <View style={{ marginTop: S.lg }}>
        <PrimaryButton label={t('admin.enter')} onPress={() => nav.replace('AdminHome')} />
      </View>

      <Txt variant="caption" style={{ textAlign: 'center', marginTop: S.md }}>
        {t('admin.note')}
      </Txt>
      <Txt variant="caption" color={C.mut} style={{ textAlign: 'center', marginTop: 4 }}>
        {t('admin.demoNote')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', marginTop: S.xl, marginBottom: S.xl },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.md,
  },
  logoTxt: { fontFamily: F.head, color: '#fff', fontSize: 24 },
  lbl: { marginBottom: S.sm, marginTop: S.md },
  input: {
    minHeight: 48,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.chip,
    paddingHorizontal: S.lg,
    color: C.txt,
    fontFamily: F.body,
    fontSize: 16,
  },
});
