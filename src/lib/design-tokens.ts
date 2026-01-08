/**
 * Design Tokens para o sistema RESPONSUM
 * Paleta de cores e tokens visuais para manter consistência na identidade visual
 */

export const COLORS = {
  // Cores principais
  PRIMARY: '#F69F19', // amarelo/laranja — velocidade, resposta
  SECONDARY: '#DE5532', // laranja avermelhado — ação, humanização
  ACCENT: '#BD2D29', // vermelho — urgência, realidade
  
  // Neutros
  DARK: '#2C2D2F', // background escuro
  LIGHT: '#F6F6F6', // surface (cards/modais) ou branco
  
  // Variações de cinza intermediários
  GRAY_100: '#F6F6F6',
  GRAY_200: '#E8E8E8',
  GRAY_300: '#D1D1D1',
  GRAY_400: '#B7B7B7',
  GRAY_500: '#949494',
  GRAY_600: '#777777',
  GRAY_700: '#5C5C5C',
  GRAY_800: '#444444',
  GRAY_900: '#2C2D2F',
  
  // Gradiente
  GRADIENT: 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)',
};

export const TYPOGRAPHY = {
  // Configurações de tipografia
  FONT_FAMILY: 'Montserrat, sans-serif',
  FONT_SIZES: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    md: '1rem',      // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  FONT_WEIGHTS: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

export const BORDERS = {
  radius: {
    sm: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem',   // 8px
    xl: '0.75rem',  // 12px
    full: '9999px', // Círculo completo
  },
  width: {
    thin: '1px',
    medium: '2px',
    thick: '3px',
  },
};

export const TRANSITIONS = {
  DEFAULT: 'all 0.2s ease',
  FAST: 'all 0.1s ease',
  SLOW: 'all 0.3s ease',
};

export const SPACING = {
  '0': '0',
  '1': '0.25rem', // 4px
  '2': '0.5rem',  // 8px
  '3': '0.75rem', // 12px
  '4': '1rem',    // 16px
  '5': '1.25rem', // 20px
  '6': '1.5rem',  // 24px
  '8': '2rem',    // 32px
  '10': '2.5rem', // 40px
  '12': '3rem',   // 48px
  '16': '4rem',   // 64px
  '20': '5rem',   // 80px
  '24': '6rem',   // 96px
  '32': '8rem',   // 128px
};

export default {
  COLORS,
  TYPOGRAPHY,
  SHADOWS,
  BORDERS,
  TRANSITIONS,
  SPACING,
};