import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GangBanner } from '@/components/ui/gang-banner';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, type } from '@/lib/gaingang-theme';
import type { GangSummary } from '@/types';

interface GangSelectorProps {
  gangs: GangSummary[];
  selectedId: string;
  onSelect: (gangId: string) => void;
  onPressMembers?: () => void;
  /** Rendered on the members row (e.g. invite + options). */
  actions?: ReactNode;
}

export function GangSelector({
  gangs,
  selectedId,
  onSelect,
  onPressMembers,
  actions,
}: GangSelectorProps) {
  const t = useThemeTokens();
  const [open, setOpen] = useState(false);
  const selected = gangs.find((g) => g.id === selectedId) ?? gangs[0];

  if (!selected) return null;

  const hasMultipleGangs = gangs.length > 1;
  const titleStyle = [type.heading, { color: t.heading, flexShrink: 1 }];
  const memberCount = selected.member_count ?? 0;
  const memberLabel = `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;
  const showMembersRow = !!onPressMembers || !!actions;

  const hasBanner = !!selected.banner_url;
  const title = (
    <View className="flex-row items-center gap-1" style={{ flexShrink: 1, minWidth: 0 }}>
      <Text style={titleStyle} numberOfLines={1}>
        {selected.name}
      </Text>
      {hasMultipleGangs ? (
        <Ionicons name="chevron-down" size={22} color={t.heading} style={{ flexShrink: 0 }} />
      ) : null}
    </View>
  );

  const titleBlock = hasMultipleGangs ? (
    <TouchableOpacity
      onPress={() => setOpen(true)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Viewing ${selected.name}. Tap to switch gang.`}
      style={{ flexShrink: 1, minWidth: 0 }}
    >
      {title}
    </TouchableOpacity>
  ) : (
    title
  );

  return (
    <>
      <View style={{ gap: 10, width: '100%' }}>
        <View className="flex-row items-center gap-3" style={{ width: '100%' }}>
          {hasBanner ? (
            <GangBanner uri={selected.banner_url} variant="thumb" size={44} />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>{titleBlock}</View>
        </View>

        {showMembersRow ? (
          <View className="flex-row items-center gap-2">
            {onPressMembers ? (
              <TouchableOpacity
                onPress={onPressMembers}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${memberLabel}`}
                hitSlop={6}
                style={{ flexShrink: 1 }}
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="people-outline" size={15} color={t.body} />
                  <Text style={[type.bodySm, { color: t.body }]} numberOfLines={1}>
                    {memberLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={t.body} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {actions ? (
              <View className="flex-row items-center gap-2" style={{ marginLeft: 'auto' }}>
                {actions}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {hasMultipleGangs ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            className="flex-1 justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onPress={() => setOpen(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                className="rounded-t-3xl px-5 pb-8 pt-5"
                style={{ backgroundColor: t.buttonBg, borderTopWidth: 1, borderColor: t.buttonBorder }}
              >
                <Text style={{ color: t.heading }} className="mb-4 text-lg font-bold">
                  Switch gang
                </Text>
                <ScrollView style={{ maxHeight: 320 }} className="gap-2">
                  {gangs.map((gang) => {
                    const isSelected = gang.id === selectedId;
                    return (
                      <TouchableOpacity
                        key={gang.id}
                        onPress={() => {
                          onSelect(gang.id);
                          setOpen(false);
                        }}
                        className="mb-2 flex-row items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                          backgroundColor: isSelected ? t.accent : 'transparent',
                          borderWidth: 1,
                          borderColor: isSelected ? t.accent : t.buttonBorder,
                        }}
                      >
                        <GangBanner uri={gang.banner_url} variant="thumb" />
                        <View className="flex-1">
                          <Text
                            style={{
                              fontFamily: fontFamily.bodySemi,
                              color: isSelected ? t.accentOnPrimary : t.heading,
                            }}
                            numberOfLines={1}
                          >
                            {gang.name}
                          </Text>
                          <Text
                            style={{
                              color: isSelected ? t.accentOnPrimary : t.body,
                              opacity: 0.8,
                              fontSize: 12,
                            }}
                          >
                            {gang.member_count} {gang.member_count === 1 ? 'member' : 'members'}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={22} color={t.accentOnPrimary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}
