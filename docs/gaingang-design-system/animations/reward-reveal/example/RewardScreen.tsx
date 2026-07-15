/**
 * Example usage of <RewardReveal />.
 *
 * Drop this in a screen, press the button, and the sigil opens → flash →
 * reward is revealed. `onClaim` dismisses it.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RewardReveal } from '../src';

export default function RewardScreen() {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.screen}>
      <Pressable style={styles.trigger} onPress={() => setShow(true)}>
        <Text style={styles.triggerText}>OPEN REWARD</Text>
      </Pressable>

      <RewardReveal
        visible={show}
        onClaim={() => setShow(false)}
        // tier recolours the whole reveal: 'aura' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
        tier="aura"
        kicker="NEW REWARD UNLOCKED"
        title="Shadow Sovereign's Gauntlets"
        subtitle="Awarded for completing the 30-day Iron Oath."
        // bannerSource={require('../assets/gauntlets.png')}  // ← drop in your image
        rewards={[
          { label: 'XP EARNED',      value: '+540',          icon: '✦', color: '#FFBD52' },
          { label: 'RANK PROGRESS',  value: 'B → A',         icon: '▲' },
          { label: 'TITLE UNLOCKED', value: 'Iron Disciple', icon: '❖', color: '#8FB4FF' },
        ]}
        claimLabel="CLAIM REWARD"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070F', alignItems: 'center', justifyContent: 'center' },
  trigger: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: '#4D8CFF',
  },
  triggerText: { color: '#fff', fontSize: 15, letterSpacing: 1.5, fontWeight: '700' },
});
