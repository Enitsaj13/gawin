import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { usePreferences } from '@/features/preferences/preferences-context';

type LoadingScreenProps = {
  ready: boolean;
  onFinished: () => void;
};

export function LoadingScreen({ ready, onFinished }: LoadingScreenProps) {
  const { preferences } = usePreferences();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const [fillScale] = useState(() => new Animated.Value(0));
  const [iconOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0.94));
  const [checkOpacity] = useState(() => new Animated.Value(0));
  const finishingRef = useRef(false);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(iconOpacity, {
        duration: preferences.reducedMotion ? 0 : 180,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        duration: preferences.reducedMotion ? 0 : 240,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    intro.start();

    const timer = setTimeout(
      () => setMinimumElapsed(true),
      preferences.reducedMotion ? 0 : 300,
    );
    return () => {
      clearTimeout(timer);
      intro.stop();
    };
  }, [iconOpacity, iconScale, preferences.reducedMotion]);

  useEffect(() => {
    if (!ready || !minimumElapsed || finishingRef.current) return;
    finishingRef.current = true;

    const finish = Animated.sequence([
      Animated.timing(fillScale, {
        duration: preferences.reducedMotion ? 0 : 210,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(checkOpacity, {
          duration: preferences.reducedMotion ? 0 : 130,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(iconScale, {
            duration: preferences.reducedMotion ? 0 : 90,
            toValue: 1.04,
            useNativeDriver: true,
          }),
          Animated.timing(iconScale, {
            duration: preferences.reducedMotion ? 0 : 110,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(preferences.reducedMotion ? 0 : 100),
      Animated.timing(contentOpacity, {
        duration: preferences.reducedMotion ? 0 : 180,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);

    finish.start(({ finished }) => {
      if (finished) onFinishedRef.current();
    });

    return () => finish.stop();
  }, [
    checkOpacity,
    contentOpacity,
    fillScale,
    iconScale,
    minimumElapsed,
    preferences.reducedMotion,
    ready,
  ]);

  return (
    <View style={styles.container}>
      <Animated.View
        accessibilityLabel="Loading tasks"
        accessibilityRole="progressbar"
        style={[
          styles.icon,
          {
            opacity: Animated.multiply(contentOpacity, iconOpacity),
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <Animated.View
          style={[styles.fill, { transform: [{ scale: fillScale }] }]}
        />
        <Animated.View style={[styles.check, { opacity: checkOpacity }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbfbf9',
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#181817',
  },
  fill: {
    position: 'absolute',
    top: -1.5,
    right: -1.5,
    bottom: -1.5,
    left: -1.5,
    backgroundColor: '#181817',
  },
  check: {
    width: 10,
    height: 18,
    marginTop: -4,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#ffffff',
    transform: [{ rotate: '45deg' }],
  },
});
