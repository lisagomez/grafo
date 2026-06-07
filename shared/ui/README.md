# 📊 Dashboard UI Module

This module provides pre-built UI components for creating beautiful dashboards.

## 📦 Dependencies

Add these to your `package.json`:

### Frontend (Next.js)
```json
{
  "dependencies": {
    "lucide-react": "^0.330.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "date-fns": "^3.3.1"
  }
}
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── components/
│       ├── ui/
│       │   ├── Button.jsx
│       │   ├── Card.jsx
│       │   ├── Input.jsx
│       │   ├── Modal.jsx
│       │   └── StatCard.jsx
│       └── layouts/
│           └── DashboardLayout.tsx
```

## 🎨 Components

### Button

```jsx
import { Button } from '@/components/ui/Button';

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// With icon
<Button>
  <PlusIcon className="w-4 h-4 mr-2" />
  Add Item
</Button>

// Loading state
<Button isLoading>Saving...</Button>

// Disabled
<Button disabled>Disabled</Button>
```

### Card

```jsx
import { Card } from '@/components/ui/Card';

<Card>
  <Card.Header>
    <Card.Title>Card Title</Card.Title>
    <Card.Description>Optional description</Card.Description>
  </Card.Header>
  <Card.Content>
    Your content here
  </Card.Content>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>

// Compact card
<Card padding="sm">Small padding</Card>
<Card padding="lg">Large padding</Card>
```

### Input

```jsx
import { Input } from '@/components/ui/Input';

// Basic
<Input 
  label="Email"
  type="email"
  placeholder="you@example.com"
/>

// With error
<Input 
  label="Password"
  type="password"
  error="Password is required"
/>

// With icon
<Input 
  label="Search"
  leftIcon={<SearchIcon />}
/>

// With helper text
<Input 
  label="Username"
  helperText="Only letters and numbers"
/>
```

### Modal

```jsx
import { Modal } from '@/components/ui/Modal';

const [isOpen, setIsOpen] = useState(false);

<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
>
  <p>Are you sure you want to proceed?</p>
  
  <Modal.Footer>
    <Button variant="outline" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="danger" onClick={handleConfirm}>
      Delete
    </Button>
  </Modal.Footer>
</Modal>

// Sizes
<Modal size="sm">Small modal</Modal>
<Modal size="md">Medium modal (default)</Modal>
<Modal size="lg">Large modal</Modal>
<Modal size="xl">Extra large modal</Modal>
```

### StatCard

```jsx
import { StatCard } from '@/components/ui/StatCard';

<StatCard
  title="Total Revenue"
  value="$45,231.89"
  change="+20.1%"
  changeType="positive"
  icon={<DollarSignIcon />}
/>

<StatCard
  title="Active Users"
  value="2,350"
  change="-4.3%"
  changeType="negative"
  icon={<UsersIcon />}
/>

<StatCard
  title="Pending Orders"
  value="12"
  icon={<PackageIcon />}
/>
```

### DashboardLayout

```jsx
import { DashboardLayout } from '@/components/layouts/DashboardLayout';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <h1>Dashboard</h1>
      {/* Your dashboard content */}
    </DashboardLayout>
  );
}
```

## 🎨 Tailwind Configuration

Make sure your `tailwind.config.js` includes the custom colors:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
        },
      },
    },
  },
};
```

## 📝 Example: Dashboard Page

```jsx
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Package 
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Revenue"
            value="$45,231"
            change="+20.1%"
            changeType="positive"
            icon={<DollarSign />}
          />
          <StatCard
            title="Active Users"
            value="2,350"
            change="+180"
            changeType="positive"
            icon={<Users />}
          />
          <StatCard
            title="Conversion Rate"
            value="3.2%"
            change="-0.4%"
            changeType="negative"
            icon={<TrendingUp />}
          />
          <StatCard
            title="Active Projects"
            value="12"
            icon={<Package />}
          />
        </div>
        
        {/* Content Card */}
        <Card>
          <Card.Header>
            <Card.Title>Recent Activity</Card.Title>
          </Card.Header>
          <Card.Content>
            {/* Your content */}
          </Card.Content>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

## 🎨 Utility: cn() Function

Use the `cn()` utility for conditional class merging:

```jsx
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  variant === 'primary' && 'primary-classes',
  className
)}>
```

```javascript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## ❓ Need Help?

- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/icons)

