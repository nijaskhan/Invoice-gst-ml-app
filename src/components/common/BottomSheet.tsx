import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { layout, motion, radius, space, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { IconButton } from './IconButton';

const useNativeDriver = Platform.OS !== 'web';

/**
 * Modal sheet that slides from the bottom. Dismiss by tapping the backdrop,
 * dragging the handle down, the close button, or Android back.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  fullHeight = false,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Use for long, scrollable content such as pickers. */
  fullHeight?: boolean;
}) {
  const { reducedMotion } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: reducedMotion ? motion.fast : motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: motion.base,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [visible, mounted, progress, drag, reducedMotion]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 6,
      onPanResponderMove: (_event, gesture) => {
        drag.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 1.1) {
          onCloseRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver, bounciness: 0 }).start();
        }
      },
    }),
  ).current;

  if (!mounted) {
    return null;
  }

  const offscreen = reducedMotion ? 24 : windowHeight * 0.6;
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] }),
    drag,
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { maxHeight: windowHeight - insets.top - space[6] },
            fullHeight && { height: windowHeight * 0.82 },
            { paddingBottom: footer ? 0 : Math.max(insets.bottom, space[4]) },
            { opacity: reducedMotion ? progress : 1, transform: [{ translateY }] },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.header}>
            <View style={styles.handle} />
            {title ? (
              <View style={styles.titleRow}>
                <View style={styles.titleText}>
                  <Text variant="h3" accessibilityRole="header">
                    {title}
                  </Text>
                  {description ? (
                    <Text variant="bodySmall" tone="secondary">
                      {description}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon="close"
                  accessibilityLabel="Close"
                  variant="tonal"
                  size={32}
                  tone="textSecondary"
                  onPress={onClose}
                  style={styles.close}
                />
              </View>
            ) : null}
          </View>
          <View style={[styles.body, fullHeight && styles.bodyFill]}>{children}</View>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles({ colors, elevation }: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      backgroundColor: colors.overlay,
    },
    sheet: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radius.extraLarge,
      borderTopRightRadius: radius.extraLarge,
      boxShadow: elevation.high,
    },
    header: {
      paddingHorizontal: space[5],
      paddingBottom: space[2],
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.borderStrong,
      marginTop: space[2],
      marginBottom: space[3],
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
      paddingBottom: space[2],
    },
    titleText: {
      flex: 1,
      gap: space[1],
      paddingTop: space[1],
    },
    close: {
      backgroundColor: colors.surfaceSecondary,
    },
    body: {
      paddingHorizontal: space[5],
    },
    bodyFill: {
      flex: 1,
    },
    footer: {
      paddingHorizontal: space[5],
      paddingTop: space[4],
      gap: space[2],
    },
  });
}

