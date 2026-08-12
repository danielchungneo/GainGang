import { Text, View } from 'react-native';

import { CredPlate } from './cred-plate';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily } from '@/lib/gaingang-theme';

/** Currency gold — shared hue with A-rank, kept as its own constant so the
 *  wallet never silently follows a rank-palette change. */
const CREDS = { dark: '#F5A524', light: '#E0910F' };

interface CredsBalanceProps {
  amount: number;
  /** Compact chip for headers; default is a slightly larger pill. */
  size?: 'sm' | 'md';
}

/** Wallet chip showing the player's Creds balance. */
export function CredsBalance({ amount, size = 'md' }: CredsBalanceProps) {
  const t = useThemeTokens();
  const color = t.isLight ? CREDS.light : CREDS.dark;
  const isSmall = size === 'sm';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${amount.toLocaleString()} Creds`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: isSmall ? 6 : 7,
        paddingLeft: isSmall ? 6 : 7,
        paddingRight: isSmall ? 10 : 11,
        paddingVertical: isSmall ? 4 : 5,
        borderRadius: 999,
        backgroundColor: t.isLight ? `${color}55` : 'rgba(44,29,11,0.88)',
        borderWidth: 1,
        borderColor: `${color}aa`,
      }}
    >
      <CredPlate size={isSmall ? 16 : 18} />
      <Text
        style={{
          fontFamily: fontFamily.monoBold,
          fontSize: isSmall ? 12 : 13,
          color: t.heading,
        }}
      >
        {amount.toLocaleString()}
      </Text>
    </View>
  );
}
