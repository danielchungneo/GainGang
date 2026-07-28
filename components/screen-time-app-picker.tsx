import { View, type ViewStyle } from 'react-native';

import type { ScreenTimeBlockedItem } from '@/lib/screen-time-lock';

export interface FamilyActivityPickerSelectionEvent {
  selectionData: string;
  items: ScreenTimeBlockedItem[];
  totalApps: number;
  totalCategories: number;
}

interface ScreenTimeAppPickerProps {
  initialSelection: string;
  theme: 'light' | 'dark' | 'system';
  style?: ViewStyle;
  onSelectionChange: (event: FamilyActivityPickerSelectionEvent) => void;
}

/** Non-iOS stub — platform resolution picks `.ios.tsx` on iPhone. */
export function ScreenTimeAppPicker(_props: ScreenTimeAppPickerProps) {
  return <View />;
}
