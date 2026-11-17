/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#192134',
    background: '#ffffff',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#DEE5ED',
    textSecondary: '#566176',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Paleta do landing do protrack-web (landing-theme.css). Gradientes ficam
 * fora de `Colors` porque o `expo-linear-gradient` recebe uma lista de cores.
 */
export const Gradients = {
  /** "Noite" do hero/login do web: cabeçalhos, menu lateral, splash. */
  brand: ['#090E20', '#0F1933', '#19294D'] as const,
  /** Botões principais: azul-marinho como o "Entrar" do web. */
  primary: ['#0F1933', '#19294D'] as const,
  /** Azul (Estoque) para verde (Financeiro): destaques da marca. */
  accent: ['#5FA3EC', '#39C68B'] as const,
} as const;

/** Azul da marca (--primary do landing: hsl(211 79% 60%)). */
export const BrandColor = '#4896EA';
/** Verde da marca (--accent-green: hsl(155 55% 45%)). */
export const BrandGreen = '#34B27D';
/** Fundo "noite" (--night: hsl(226 58% 8%)). */
export const NightColor = '#090E20';
