import { StyleSheet, View } from 'react-native';

import { ThemeColors, useThemeStyles } from '@/theme/theme';

export function NavigationSkeleton() {
  const styles = useThemeStyles(createStyles);

  return (
    <View
      accessibilityLabel="Loading screen"
      accessibilityRole="progressbar"
      pointerEvents="none"
      style={styles.overlay}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.back} />
          <View style={styles.heading} />
          <View style={styles.meta} />
        </View>
        <View style={styles.rule} />
        <View style={styles.rows}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.row}>
              <View style={styles.checkbox} />
              <View
                style={[
                  styles.task,
                  row === 1 && styles.taskShort,
                  row === 2 && styles.taskMedium,
                ]}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      zIndex: 100,
      backgroundColor: colors.background,
    },
    content: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
      paddingHorizontal: 24,
      paddingTop: 65,
    },
    header: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    back: {
      width: 14,
      height: 20,
      backgroundColor: colors.surfacePressed,
    },
    heading: {
      width: 112,
      height: 19,
      backgroundColor: colors.surfacePressed,
    },
    meta: {
      width: 38,
      height: 10,
      marginLeft: 'auto',
      backgroundColor: colors.surfacePressed,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      marginTop: 10,
      backgroundColor: colors.border,
    },
    rows: {
      marginTop: 25,
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    task: {
      width: '57%',
      height: 12,
      backgroundColor: colors.surfacePressed,
    },
    taskShort: {
      width: '39%',
    },
    taskMedium: {
      width: '48%',
    },
  });
