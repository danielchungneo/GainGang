import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

interface GangAddMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function GangAddMenu({ visible, onClose }: GangAddMenuProps) {
  const t = useThemeTokens();

  function go(path: '/gang/create' | '/gang/join') {
    onClose();
    router.push(path);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            className="gap-3 rounded-t-3xl px-5 pb-8 pt-5"
            style={{ backgroundColor: t.buttonBg, borderTopWidth: 1, borderColor: t.buttonBorder }}
          >
            <Text style={{ color: t.heading }} className="text-lg font-bold">
              Add a gang
            </Text>

            <TouchableOpacity
              onPress={() => go('/gang/create')}
              className="flex-row items-center gap-3 rounded-xl px-4 py-4"
              style={{ backgroundColor: t.accent }}
            >
              <Ionicons name="add-circle-outline" size={22} color={t.accentOnPrimary} />
              <View className="flex-1">
                <Text style={{ color: t.accentOnPrimary }} className="font-semibold">
                  Create a gang
                </Text>
                <Text style={{ color: t.accentOnPrimary, opacity: 0.85 }} className="text-sm">
                  Start your own crew and invite friends
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => go('/gang/join')}
              className="flex-row items-center gap-3 rounded-xl px-4 py-4"
              style={{
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: t.buttonBorder,
              }}
            >
              <Ionicons name="key-outline" size={22} color={t.accent} />
              <View className="flex-1">
                <Text style={{ color: t.heading }} className="font-semibold">
                  Join a gang
                </Text>
                <Text style={{ color: t.body }} className="text-sm">
                  Enter an invite code or browse public gangs
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
