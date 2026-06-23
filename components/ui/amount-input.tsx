import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import {
  amountInputPlaceholder,
  sanitizeAmountInput,
  unitAllowsDecimals,
} from '@/lib/activity-amount';
import { UNIT_LABELS, type ExerciseUnit } from '@/types';

interface AmountInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  unit: ExerciseUnit;
  value: string;
  onChangeValue: (value: string) => void;
  label?: string;
  inputBg: string;
  inputBorder: string;
  textColor: string;
  placeholderColor: string;
  labelColor: string;
}

/** Unit-aware amount field — miles allow one decimal; reps/seconds are whole numbers. */
export function AmountInput({
  unit,
  value,
  onChangeValue,
  label,
  inputBg,
  inputBorder,
  textColor,
  placeholderColor,
  labelColor,
  style,
  ...rest
}: AmountInputProps) {
  const unitLabel = UNIT_LABELS[unit].long;

  return (
    <>
      {label ? (
        <Text style={[styles.label, { color: labelColor }]}>
          {label} ({unitLabel})
        </Text>
      ) : null}
      <TextInput
        {...rest}
        style={[
          styles.input,
          { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
          style,
        ]}
        value={value}
        onChangeText={(text) => onChangeValue(sanitizeAmountInput(text, unit))}
        keyboardType={unitAllowsDecimals(unit) ? 'decimal-pad' : 'number-pad'}
        placeholder={amountInputPlaceholder(unit)}
        placeholderTextColor={placeholderColor}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
});
