import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './demo/App';
import { ThemeProvider } from "@/components/theme-provider";
import './index.css'
import './demo/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
