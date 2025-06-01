
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from '@/hooks/useAuth.tsx'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>
);
