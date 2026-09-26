/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pulled from the AUST PIC card art itself, not a generic default.
        ink: '#0c2f38',
        teal: {
          DEFAULT: '#0f4f5e',
          dark: '#093843',
          light: '#7bc4bd',
        },
        paper: '#f3f6f5',
      },
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
        body: ['"Space Grotesk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
