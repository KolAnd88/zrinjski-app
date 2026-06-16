import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { C, F, R, TOUCH } from '../theme';
import { Txt } from './base';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  large?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, large, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        styles.primary,
        large && styles.large,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <Txt style={[styles.txt, { color: '#fff' }]}>{label}</Txt>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, large, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        styles.secondary,
        large && styles.large,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <Txt style={[styles.txt, { color: C.txt }]}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: TOUCH,
    borderRadius: R.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: C.red },
  secondary: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line },
  large: { minHeight: 56 },
  disabled: { opacity: 0.45 },
  txt: { fontFamily: F.headSemi, fontSize: 16 },
});
