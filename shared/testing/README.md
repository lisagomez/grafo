# 🧪 Testing Setup Module

Comprehensive testing infrastructure with unit tests, integration tests, and E2E tests.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Dependencies](#-dependencies)
3. [Project Structure](#-project-structure)
4. [Configuration](#-configuration)
5. [Writing Tests](#-writing-tests)
6. [Running Tests](#-running-tests)
7. [CI/CD Integration](#-cicd-integration)
8. [Best Practices](#-best-practices)

---

## 🚀 Quick Start

```bash
# Add testing module
npx saas-factory add testing

# Install dependencies
npm install

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e
```

---

## 📦 Dependencies

### Add to `package.json` (devDependencies):

```json
{
  "devDependencies": {
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "@testing-library/user-event": "^14.5.2",
    "@playwright/test": "^1.41.0",
    "msw": "^2.1.0",
    "happy-dom": "^13.3.0"
  }
}
```

### Install:

```bash
# Unit testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom msw

# E2E testing
npm install -D @playwright/test
npx playwright install
```

---

## 📁 Project Structure

```
your-project/
├── tests/
│   ├── setup.ts              # Test setup & mocks
│   ├── mocks/
│   │   ├── handlers.ts       # MSW request handlers
│   │   └── server.ts         # MSW server setup
│   ├── unit/
│   │   ├── components/       # Component tests
│   │   │   ├── Button.test.tsx
│   │   │   └── Card.test.tsx
│   │   └── utils/            # Utility tests
│   │       └── formatters.test.ts
│   └── e2e/
│       ├── auth.spec.ts      # Auth flow tests
│       └── dashboard.spec.ts # Dashboard tests
├── vitest.config.ts          # Vitest configuration
├── playwright.config.ts      # Playwright configuration
└── package.json
```

---

## ⚙️ Configuration

### Step 1: Vitest Configuration

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib')
    }
  }
});
```

### Step 2: Playwright Configuration

Create `playwright.config.ts` in project root:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
```

### Step 3: Test Setup File

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn()
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});
```

### Step 4: MSW Mock Server

Create `tests/mocks/server.ts`:

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

Create `tests/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        user: { id: '1', email: body.email, name: 'Test User' },
        accessToken: 'mock-access-token'
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      user: { id: '1', email: 'test@example.com', name: 'Test User' }
    });
  }),

  // Example API endpoints
  http.get('/api/products', () => {
    return HttpResponse.json({
      products: [
        { id: '1', name: 'Product 1', price: 99 },
        { id: '2', name: 'Product 2', price: 149 }
      ]
    });
  })
];
```

### Step 5: Add npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## ✍️ Writing Tests

### Unit Test: Component

```tsx
// tests/unit/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant styles correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary-500');
    
    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-100');
  });
});
```

### Unit Test: Hook

```tsx
// tests/unit/hooks/useAuth.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/providers/AuthProvider';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('useAuth Hook', () => {
  it('starts with no user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it('logs in successfully with valid credentials', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(result.current.user).toBeDefined();
      expect(result.current.user.email).toBe('test@example.com');
    });
  });

  it('throws error with invalid credentials', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.login('wrong@example.com', 'wrongpass');
      })
    ).rejects.toThrow('Invalid credentials');
  });
});
```

### Unit Test: Utility Function

```typescript
// tests/unit/utils/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, slugify } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
    expect(formatCurrency(99.99)).toBe('$99.99');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles different currencies', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00');
    expect(formatCurrency(1000, 'GBP')).toBe('£1,000.00');
  });
});

describe('formatDate', () => {
  it('formats dates correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });

  it('handles relative dates', () => {
    const now = new Date();
    expect(formatDate(now, 'relative')).toBe('Today');
  });
});

describe('slugify', () => {
  it('converts strings to slugs', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Test & Demo!')).toBe('test-demo');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
  });
});
```

### E2E Test: Authentication Flow

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('user can navigate to login page', async ({ page }) => {
    await page.click('text=Sign in');
    await expect(page).toHaveURL('/auth/login');
  });

  test('user can log in with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL('/auth/login');
  });

  test('user can register a new account', async ({ page }) => {
    await page.goto('/auth/register');
    
    await page.fill('input[name="name"]', 'New User');
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can log out', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    await expect(page).toHaveURL('/');
  });
});
```

---

## 🏃 Running Tests

```bash
# Run all unit tests
npm run test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage report
npm run test:coverage

# Visual UI for tests
npm run test:ui

# Run E2E tests
npm run test:e2e

# E2E with visual debugger
npm run test:e2e:ui

# Run specific test file
npx vitest tests/unit/components/Button.test.tsx
npx playwright test tests/e2e/auth.spec.ts

# Run tests matching pattern
npx vitest --grep "Button"
```

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## 📋 Best Practices

### 1. Test Organization
- Group related tests with `describe` blocks
- Use clear, descriptive test names
- Follow the AAA pattern: Arrange, Act, Assert

### 2. Test Isolation
- Each test should be independent
- Use `beforeEach` for common setup
- Clean up after tests

### 3. Mock External Services
- Use MSW for API mocking
- Don't make real network requests in unit tests

### 4. E2E Test Selectors
- Use `data-testid` attributes for reliable selection
- Avoid CSS selectors that might change

### 5. Coverage Goals
- Aim for 80%+ coverage on critical paths
- Don't chase 100% coverage at the expense of test quality

---

## ❓ Troubleshooting

### Tests timing out
- Increase timeout in config
- Check for async operations not properly awaited

### MSW not intercepting requests
- Ensure server is started in setup file
- Check request URL matches handler

### Playwright can't find element
- Use `waitFor` for dynamic content
- Check element visibility

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com)
- [Playwright Documentation](https://playwright.dev)
- [MSW Documentation](https://mswjs.io)
