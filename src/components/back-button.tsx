import { Platform, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme/theme';

export function BackButton() {
  const { colors } = useAppTheme();
  return (
    <Text
      pointerEvents="none"
      style={[styles.chevron, { color: colors.text }]}
    >
      ‹
    </Text>
  );
}

const styles = StyleSheet.create({
  chevron: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 42,
    lineHeight: 44,
    textAlignVertical: 'center',
    transform: [{ translateY: Platform.OS === 'web' ? -5 : 2 }],
  },
});
