import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/lib/database/db';
import { THEMES, ThemeStyle } from '@/lib/database/types';

interface ThemeContextType {
  theme: typeof THEMES.dark;
  themeStyle: ThemeStyle;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.dark,
  themeStyle: 'dark',
  isLoading: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const themeStyle = settings?.themeStyle || 'dark';
  const theme = THEMES[themeStyle] || THEMES.dark;

  return (
    <ThemeContext.Provider value={{ theme, themeStyle, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
