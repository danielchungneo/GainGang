import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CredPlate } from '@/components/ui/cred-plate';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { HUD_CHIP } from '@/lib/app-hud';
import { fontFamily } from '@/lib/gaingang-theme';

/** Currency gold — shared hue with A-rank, kept as its own constant so the
 *  wallet never silently follows a rank-palette change. */
const CREDS = { dark: '#F5A524', light: '#E0910F' };

interface CredsBalanceProps {
  amount: number;
  /** Compact chip for headers; default is a slightly larger pill. */
  size?: 'sm' | 'md';
  /** Opens inventory / wallet details when the amount area is pressed. */
  onPress?: () => void;
  /** Renders a + control inside the pill (Creds top-up). */
  onAddPress?: () => void;
}

/** Wallet chip showing the player's Creds balance. */
export function CredsBalance({
  amount,
  size = 'md',
  onPress,
  onAddPress,
}: CredsBalanceProps) {
  const t = useThemeTokens();
  const color = t.isLight ? CREDS.light : CREDS.dark;
  const isSmall = size === 'sm';

  const amountContent = (
    <>
      <CredPlate size={isSmall ? HUD_CHIP.plateSize : 18} />
      <Text
        style={{
          fontFamily: fontFamily.monoBold,
          fontSize: isSmall ? HUD_CHIP.fontSize : 13,
          lineHeight: isSmall ? HUD_CHIP.fontSize + 2 : 16,
          color: t.heading,
        }}
      >
        {amount.toLocaleString()}
      </Text>
    </>
  );

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${amount.toLocaleString()} Creds`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: isSmall ? HUD_CHIP.gap : 7,
        paddingLeft: isSmall ? HUD_CHIP.paddingLeft : 7,
        // Match left inset optically — the + circle needs a touch more than the plate.
        paddingRight: onAddPress
          ? isSmall
            ? HUD_CHIP.paddingLeft + 2
            : 9
          : isSmall
            ? HUD_CHIP.paddingRight
            : 11,
        paddingVertical: isSmall ? HUD_CHIP.paddingVertical : 5,
        minHeight: isSmall ? HUD_CHIP.minHeight : undefined,
        borderRadius: 999,
        backgroundColor: t.isLight ? `${color}55` : 'rgba(44,29,11,0.88)',
        borderWidth: 1,
        borderColor: `${color}aa`,
      }}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${amount.toLocaleString()} Creds. Open inventory.`}
          hitSlop={4}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: isSmall ? HUD_CHIP.gap : 7,
          }}
        >
          {amountContent}
        </Pressable>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: isSmall ? HUD_CHIP.gap : 7,
          }}
        >
          {amountContent}
        </View>
      )}

      {onAddPress ? (
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel="Top up Creds"
          hitSlop={6}
          style={{
            width: isSmall ? 22 : 24,
            height: isSmall ? 22 : 24,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${color}33`,
            borderWidth: 1,
            borderColor: `${color}88`,
          }}
        >
          <Ionicons name="add" size={isSmall ? 14 : 15} color={color} />
        </Pressable>
      ) : null}
    </View>
  );
}
