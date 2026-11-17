const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#192134',
        paper: '#ffffff',
        surface: '#F1F5F9',
        'surface-selected': '#DEE5ED',
        muted: '#566176',
        brand: '#4896EA',
        splash: '#090E20',
        night: '#090E20',
        'night-2': '#0F1933',
        'night-3': '#19294D',
        green: '#34B27D',
        'green-soft': '#E3F6EE',
        peach: '#F68E55',
        line: '#DEE5ED',
        field: '#F6F9FB',
        placeholder: '#8A94A6',
        'brand-soft': '#EBF3FD',
        'brand-line': '#C4DDF8',
        danger: '#DC2626',
        'danger-soft': '#FEE2E2',
        success: '#227754',
      },
      spacing: {
        half: '2px',
        one: '4px',
        two: '8px',
        three: '16px',
        four: '24px',
        five: '32px',
        six: '64px',
      },
      borderRadius: {
        half: '2px',
        one: '4px',
        two: '8px',
        three: '16px',
        four: '24px',
        five: '32px',
        six: '64px',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      maxWidth: {
        content: '800px',
      },
    },
  },
  plugins: [],
};
