import {
  FamilyActivityPickerView,
  type FamilyActivityPickerSelectionEvent,
} from 'expo-app-blocker';
import { View, type ViewStyle } from 'react-native';

interface ScreenTimeAppPickerProps {
  initialSelection: string;
  theme: 'light' | 'dark' | 'system';
  style?: ViewStyle;
  onSelectionChange: (event: FamilyActivityPickerSelectionEvent) => void;
}

/** iOS-only native Family Activity picker. */
export function ScreenTimeAppPicker({
  initialSelection,
  theme,
  style,
  onSelectionChange,
}: ScreenTimeAppPickerProps) {
  return (
    <View style={style}>
      <FamilyActivityPickerView
        initialSelection={initialSelection}
        onSelectionChange={onSelectionChange}
        theme={theme}
        style={{ flex: 1, height: (style?.height as number | undefined) ?? 420 }}
      />
    </View>
  );
}

export type { FamilyActivityPickerSelectionEvent };
