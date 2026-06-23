import { forwardRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

/**
 * Drop-in ScrollView that keeps focused inputs visible above the keyboard.
 * Use on any screen with TextInputs — especially modals and long forms.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      keyboardShouldPersistTaps,
      automaticallyAdjustKeyboardInsets,
      keyboardDismissMode,
      style,
      ...props
    },
    ref,
  ) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={ref}
          style={[{ flex: 1 }, style]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
          automaticallyAdjustKeyboardInsets={
            automaticallyAdjustKeyboardInsets ?? true
          }
          keyboardDismissMode={keyboardDismissMode ?? 'interactive'}
          {...props}
        />
      </KeyboardAvoidingView>
    );
  },
);
