import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { GangSummary } from '@/types';

interface GangSelectorProps {
  gangs: GangSummary[];
  selectedId: string;
  onSelect: (gangId: string) => void;
}

export function GangSelector({ gangs, selectedId, onSelect }: GangSelectorProps) {
  const t = useThemeTokens();
  const [open, setOpen] = useState(false);
  const selected = gangs.find((g) => g.id === selectedId) ?? gangs[0];

  if (!selected) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}>
        <GlassSurface
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: t.accent }}
          >
            <Text style={{ fontSize: 18 }}>{selected.icon ?? '⚔️'}</Text>
          </View>
          <View className="flex-1">
            <Text style={{ color: t.body }} className="text-xs uppercase tracking-wide">
              Your gang
            </Text>
            <Text style={{ color: t.heading }} className="text-lg font-bold" numberOfLines={1}>
              {selected.name}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={t.body} />
        </GlassSurface>
      </TouchableOpacity>

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
                      <View
                        className="h-9 w-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : t.accent }}
                      >
                        <Text style={{ fontSize: 16 }}>{gang.icon ?? '⚔️'}</Text>
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ color: isSelected ? t.accentOnPrimary : t.heading }}
                          className="font-semibold"
                          numberOfLines={1}
                        >
                          {gang.name}
                        </Text>
                        <Text
                          style={{ color: isSelected ? t.accentOnPrimary : t.body, opacity: 0.8 }}
                          className="text-xs"
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
    </>
  );
}
