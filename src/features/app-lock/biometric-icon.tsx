import Svg, { Path, Rect } from 'react-native-svg';
import { useAppTheme } from '@/theme/theme';
import type { BiometricIconKind } from './biometric-types';

export function BiometricIcon({ kind, size = 23 }: { kind: BiometricIconKind; size?: number }) {
  const { colors } = useAppTheme();
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} focusable={false}>
    {kind === 'face' ? <>
      <Path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
      <Path d="M8 8v2m8-2v2m-4-2v5h-1m-3 3q4 3 8 0" />
    </> : kind === 'fingerprint' ? <>
      <Path d="M4 10a8 8 0 0 1 15-3M3 14v-2m18 0v3m-1 4a15 15 0 0 1-1 3" />
      <Path d="M7 18a17 17 0 0 1-1-6 6 6 0 0 1 12 0v4a12 12 0 0 1-2 6" />
      <Path d="M11 22a10 10 0 0 0 4-8v-2a3 3 0 0 0-6 0v3m0 4a12 12 0 0 1-1-3m4-4v3a7 7 0 0 1-2 5" />
    </> : <>
      <Rect x={5} y={2} width={14} height={20} rx={1.5} />
      <Path d="M10 5h4m-3 14h2m-4-7 2 2 4-4" />
    </>}
  </Svg>;
}
