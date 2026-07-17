import { Text, type TextProps, type TextStyle } from 'react-native';

import { getAppVersionInfo } from '@/lib/app-version';

interface AppVersionLabelProps {
  color: string;
  style?: TextStyle;
  accessibilityRole?: TextProps['accessibilityRole'];
}

/** Compact version + OTA id so you can confirm updates landed. */
export function AppVersionLabel({ color, style, accessibilityRole = 'text' }: AppVersionLabelProps) {
  const info = getAppVersionInfo();

  return (
    <Text
      accessibilityRole={accessibilityRole}
      accessibilityLabel={`App version ${info.label}`}
      style={[
        {
          color,
          fontSize: 12,
          lineHeight: 16,
          textAlign: 'center',
          opacity: 0.75,
        },
        style,
      ]}
    >
      {info.label}
    </Text>
  );
}
