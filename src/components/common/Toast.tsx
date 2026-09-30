import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { layout, motion, radius, space, type Palette, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type ToastTone = 'success' | 'error' | 'info';
type ToastInput = { message: string; tone?: ToastTone };
type ToastItem = Required<ToastInput> & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);
const useNativeDriver = Platform.OS !== 'web';
const VISIBLE_MS = 2800;

const toneIcon: Record<ToastTone, { icon: IconName; color: keyof Palette }> = {
  success: { icon: 'checkmark-circle', color: 'success' },
  error: { icon: 'alert-circle', color: 'error' },
  info: { icon: 'information-circle', color: 'info' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const counter = useRef(0);

  const show = useCallback((input: ToastInput) => {
    counter.current += 1;
    setToast({ id: counter.current, message: input.message, tone: input.tone ?? 'info' });
    AccessibilityInfo.announceForAccessibility(input.message);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHidden={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onHidden }: { toast: ToastItem; onHidden: () => void }) {
  const { colors, reducedMotion } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  const hide = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: motion.base,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(() => onHiddenRef.current());
  }, [progress]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [hide, progress]);

  const { icon, color } = toneIcon[toast.tone];
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + space[2] }]}>
      <Animated.View
        style={{
          opacity: progress,
          transform: reducedMotion
            ? []
            : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        }}
      >
        <PressableScale
          onPress={hide}
          accessibilityRole="alert"
          accessibilityLabel={toast.message}
          accessibilityHint="Dismisses the message"
          style={styles.toast}
        >
          <Icon name={icon} color={colors[color]} />
          <Text variant="bodyMedium" style={styles.message} numberOfLines={3}>
            {toast.message}
          </Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return useMemo(
    () => ({
      show,
      success: (message: string) => show({ message, tone: 'success' }),
      error: (message: string) => show({ message, tone: 'error' }),
      info: (message: string) => show({ message, tone: 'info' }),
    }),
    [show],
  );
}

function createStyles({ colors, elevation }: Theme) {
  return StyleSheet.create({
    host: {
      position: 'absolute',
      left: space[4],
      right: space[4],
      alignItems: 'center',
    },
    toast: {
      width: '100%',
      maxWidth: layout.maxContentWidth - space[8],
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      minHeight: 52,
      borderRadius: radius.large,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      boxShadow: elevation.medium,
    },
    message: {
      flex: 1,
    },
  });
}
