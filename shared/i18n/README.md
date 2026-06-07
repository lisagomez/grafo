# 🌐 Internationalization (i18n) Module

This module provides multilingual support for your SaaS application.

## 📦 Dependencies

```json
{
  "dependencies": {
    "next-intl": "^3.4.0"
  }
}
```

## 🔧 Environment Variables

```env
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_LOCALES=en,es,fr,de,ja
```

## 📁 Files Added

```
your-project/
├── frontend/
│   ├── i18n.ts
│   ├── middleware.ts
│   ├── app/
│   │   └── [locale]/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   └── components/
│       └── LanguageSwitcher.tsx
├── messages/
│   ├── en.json
│   ├── es.json
│   └── fr.json
└── shared/i18n/
    └── README.md
```

## 🚀 Usage

### Configuration

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es', 'fr', 'de', 'ja'] as const;
export const defaultLocale = 'en';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

### Translation Files

```json
// messages/en.json
{
  "common": {
    "welcome": "Welcome",
    "login": "Log in",
    "signup": "Sign up",
    "logout": "Log out"
  },
  "hero": {
    "title": "Build faster with {appName}",
    "subtitle": "The all-in-one platform for modern teams"
  },
  "pricing": {
    "title": "Simple pricing",
    "monthly": "Monthly",
    "yearly": "Yearly"
  }
}
```

```json
// messages/es.json
{
  "common": {
    "welcome": "Bienvenido",
    "login": "Iniciar sesión",
    "signup": "Registrarse",
    "logout": "Cerrar sesión"
  },
  "hero": {
    "title": "Construye más rápido con {appName}",
    "subtitle": "La plataforma todo en uno para equipos modernos"
  }
}
```

### Using Translations

```tsx
// In Server Components
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('hero');
  
  return (
    <div>
      <h1>{t('title', { appName: 'SaaS Factory' })}</h1>
      <p>{t('subtitle')}</p>
    </div>
  );
}

// In Client Components
'use client';
import { useTranslations } from 'next-intl';

export function LoginButton() {
  const t = useTranslations('common');
  return <button>{t('login')}</button>;
}
```

### Language Switcher

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <select 
      value={locale} 
      onChange={(e) => switchLocale(e.target.value)}
      className="border rounded px-2 py-1"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
```

### Middleware

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
```

## 📋 Best Practices

1. **Use namespaces** - Organize by feature (`common`, `auth`, `dashboard`)
2. **Use ICU format** - For plurals and variables
3. **Lazy load** - Only load needed translations
4. **SEO** - Add hreflang tags

## ❓ Need Help?

- [next-intl Documentation](https://next-intl-docs.vercel.app)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

