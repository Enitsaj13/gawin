import { Platform, StyleSheet, Text } from 'react-native';

export function BackButton() {
  return (
    <Text pointerEvents="none" style={styles.chevron}>
      ‹
    </Text>
  );
}

const styles = StyleSheet.create({
  chevron: {
    color: '#181817',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 42,
    lineHeight: 44,
    textAlignVertical: 'center',
    transform: [{ translateY: Platform.OS === 'web' ? -3 : 4 }],
  },
});
