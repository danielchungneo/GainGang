import { type ReactNode, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { CameraUiRotation } from '@/lib/rep-counting/landmark-orientation';

interface CameraLayout {
  width: number;
  height: number;
}

interface HudLayout extends CameraLayout {
  rotation: CameraUiRotation;
}

interface CameraSidewaysStageProps {
  /** Controlled by the screen header rotate control. */
  rotation: CameraUiRotation;
  /** Live preview + skeleton — never rotated; always matches the phone sensor. */
  camera: (layout: CameraLayout) => ReactNode;
  /** Reps / warnings — rotated so they stay readable when the phone is tipped. */
  hud: (layout: HudLayout) => ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CameraSidewaysStage({
  rotation,
  camera,
  hud: renderHud,
  style,
}: CameraSidewaysStageProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const hasLayout = layout.width > 0 && layout.height > 0;
  const isSideways = rotation !== 0;

  // Landscape box when tipped so HUD width follows the phone's long edge
  // (lets warnings stay on one line). Camera stays in the portrait box.
  const hudWidth = isSideways ? layout.height : layout.width;
  const hudHeight = isSideways ? layout.width : layout.height;

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }

  const hudStageStyle = useMemo(() => {
    if (!isSideways || !hasLayout) return StyleSheet.absoluteFill;

    return {
      position: 'absolute' as const,
      width: hudWidth,
      height: hudHeight,
      left: (layout.width - hudWidth) / 2,
      top: (layout.height - hudHeight) / 2,
      transform: [{ rotate: `${rotation}deg` }],
    };
  }, [hasLayout, hudHeight, hudWidth, isSideways, layout.height, layout.width, rotation]);

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {hasLayout ? (
        <>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {camera({ width: layout.width, height: layout.height })}
          </View>

          <View style={hudStageStyle} pointerEvents="box-none">
            {renderHud({
              width: hudWidth,
              height: hudHeight,
              rotation,
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});
