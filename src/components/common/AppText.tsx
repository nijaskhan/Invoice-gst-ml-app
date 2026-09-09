import { Text, type TextProps } from 'react-native';
import { colors } from '../../theme/theme';

export function Title({ children, style, ...props }: TextProps) {
  return (
    <Text style={[{ fontSize: 28, fontWeight: '700', color: colors.ink }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }: TextProps) {
  return (
    <Text style={[{ fontSize: 16, color: colors.ink }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, ...props }: TextProps) {
  return (
    <Text style={[{ fontSize: 14, color: colors.muted }, style]} {...props}>
      {children}
    </Text>
  );
}
