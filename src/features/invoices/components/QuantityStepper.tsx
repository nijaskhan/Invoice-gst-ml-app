import { quantityMilliToText, quantityTextToMilli } from '@invoice-gst/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/common/AppText';
import { IconButton } from '../../../components/common/IconButton';
import { useTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, space, typography, type Theme } from '../../../theme/theme';
import { haptics } from '../../../utils/haptics';

const STEP_MILLI = 1000;

/**
 * − / quantity / + control. The text field keeps its own buffer while focused
 * so partial input such as "1." or "0.2" can be typed; valid values are pushed
 * up as they are entered, and the display re-syncs on blur.
 */
export function QuantityStepper({
  quantityMilli,
  unit,
  productName,
  onChange,
  onRemove,
}: {
  quantityMilli: number;
  unit: string;
  productName: string;
  onChange: (quantityMilli: number) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(() => quantityMilliToText(quantityMilli));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(quantityMilliToText(quantityMilli));
    }
  }, [quantityMilli, focused]);

  const atMinimum = quantityMilli <= STEP_MILLI;

  return (
    <View style={styles.wrap}>
      <IconButton
        icon={atMinimum ? 'trash-outline' : 'remove'}
        accessibilityLabel={atMinimum ? `Remove ${productName}` : `Decrease ${productName}`}
        variant="outlined"
        size={34}
        tone={atMinimum ? 'error' : 'textPrimary'}
        onPress={() => {
          haptics.selection();
          if (atMinimum) {
            onRemove();
          } else {
            onChange(quantityMilli - STEP_MILLI);
          }
        }}
      />
      <View style={styles.valueBox}>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            try {
              onChange(quantityTextToMilli(value || '0'));
            } catch {
              // Leave partial input in the buffer until it parses.
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          selectionColor={colors.primaryText}
          accessibilityLabel={`${productName} quantity in ${unit}`}
          style={styles.input}
          maxLength={9}
        />
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {unit}
        </Text>
      </View>
      <IconButton
        icon="add"
        accessibilityLabel={`Increase ${productName}`}
        variant="tonal"
        size={34}
        onPress={() => {
          haptics.selection();
          onChange(quantityMilli + STEP_MILLI);
        }}
      />
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
    },
    valueBox: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: space[2],
      borderRadius: radius.small,
      backgroundColor: colors.surfaceSecondary,
    },
    input: {
      // Explicit width: web inputs otherwise default to ~20 characters wide.
      width: 52,
      padding: 0,
      fontSize: typography.bodyMedium.fontSize,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      color: colors.textPrimary,
    },
  });
}
