# 🚀 Onboarding Flow Module

This module provides a step-by-step setup wizard for new users.

## 📦 Dependencies

Add these to your `package.json`:

### Frontend (Next.js)
```json
{
  "dependencies": {
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.330.0"
  }
}
```

## 🔧 Environment Variables

```env
# Onboarding
ONBOARDING_REQUIRED=true
ONBOARDING_SKIP_ALLOWED=true
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── app/
│       └── onboarding/
│           ├── page.tsx
│           ├── layout.tsx
│           └── steps/
│               ├── WelcomeStep.tsx
│               ├── ProfileStep.tsx
│               ├── WorkspaceStep.tsx
│               ├── TeamStep.tsx
│               ├── PreferencesStep.tsx
│               └── CompleteStep.tsx
└── shared/onboarding/
    └── README.md
```

## 🗄️ Database Schema (Prisma)

```prisma
model User {
  // ... existing fields
  onboardingCompleted Boolean   @default(false)
  onboardingStep      Int       @default(0)
  onboardingData      Json?     // Store intermediate data
}

model OnboardingProgress {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id])
  
  currentStep Int      @default(0)
  totalSteps  Int      @default(5)
  completed   Boolean  @default(false)
  skipped     Boolean  @default(false)
  
  stepData    Json?    // Data collected at each step
  
  startedAt   DateTime @default(now())
  completedAt DateTime?
}
```

## 🚀 Usage

### Onboarding Steps Configuration

```typescript
// config/onboarding.ts
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Let\'s get you set up',
    component: 'WelcomeStep',
    required: true
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Tell us about yourself',
    component: 'ProfileStep',
    required: true,
    fields: ['name', 'avatar', 'role']
  },
  {
    id: 'workspace',
    title: 'Create Workspace',
    description: 'Set up your first workspace',
    component: 'WorkspaceStep',
    required: true,
    fields: ['workspaceName', 'workspaceSlug']
  },
  {
    id: 'team',
    title: 'Invite Team',
    description: 'Bring your team on board',
    component: 'TeamStep',
    required: false,
    fields: ['invites']
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your experience',
    component: 'PreferencesStep',
    required: false,
    fields: ['theme', 'notifications', 'timezone']
  }
];
```

### Onboarding Page Component

```tsx
// app/onboarding/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/config/onboarding';

// Step components
import WelcomeStep from './steps/WelcomeStep';
import ProfileStep from './steps/ProfileStep';
import WorkspaceStep from './steps/WorkspaceStep';
import TeamStep from './steps/TeamStep';
import PreferencesStep from './steps/PreferencesStep';

const STEP_COMPONENTS = {
  WelcomeStep,
  ProfileStep,
  WorkspaceStep,
  TeamStep,
  PreferencesStep
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const StepComponent = STEP_COMPONENTS[step.component];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  const handleNext = async (stepData: any) => {
    const newFormData = { ...formData, [step.id]: stepData };
    setFormData(newFormData);

    // Save progress
    await fetch('/api/onboarding/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentStep: currentStep + 1,
        stepData: newFormData
      })
    });

    if (isLastStep) {
      await completeOnboarding(newFormData);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = async () => {
    if (!step.required) {
      handleNext({});
    }
  };

  const completeOnboarding = async (data: any) => {
    setIsLoading(true);
    
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      router.push('/dashboard?onboarding=complete');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Step {currentStep + 1} of {ONBOARDING_STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {ONBOARDING_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                ${i < currentStep 
                  ? 'bg-primary-500 text-white' 
                  : i === currentStep 
                    ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-500' 
                    : 'bg-gray-100 text-gray-400'
                }
              `}
            >
              {i < currentStep ? <Check className="w-5 h-5" /> : i + 1}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {step.title}
              </h2>
              <p className="text-gray-600 mb-8">{step.description}</p>

              <StepComponent
                data={formData[step.id]}
                onNext={handleNext}
                onBack={handleBack}
                onSkip={!step.required ? handleSkip : undefined}
                isFirstStep={currentStep === 0}
                isLastStep={isLastStep}
                isLoading={isLoading}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
```

### Profile Step Component

```tsx
// steps/ProfileStep.tsx
'use client';

import { useState } from 'react';
import { User, Camera } from 'lucide-react';

export default function ProfileStep({ data, onNext, onBack }) {
  const [name, setName] = useState(data?.name || '');
  const [role, setRole] = useState(data?.role || '');
  const [avatar, setAvatar] = useState(data?.avatar || null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext({ name, role, avatar });
  };

  const ROLES = [
    'Founder / CEO',
    'Product Manager',
    'Developer',
    'Designer',
    'Marketing',
    'Other'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar Upload */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            {avatar ? (
              <img src={avatar} className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center cursor-pointer">
            <Camera className="w-4 h-4 text-white" />
            <input type="file" accept="image/*" className="hidden" />
          </label>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500"
          placeholder="John Doe"
          required
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What best describes your role?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`
                p-3 text-sm rounded-lg border-2 transition-colors
                ${role === r 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 text-gray-600 hover:text-gray-900"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!name || !role}
          className="px-8 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </form>
  );
}
```

### Backend API Routes

```javascript
// routes/onboarding.js

// Get onboarding progress
router.get('/progress', authMiddleware, async (req, res) => {
  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId: req.user.id }
  });
  res.json(progress || { currentStep: 0 });
});

// Update progress
router.put('/progress', authMiddleware, async (req, res) => {
  const { currentStep, stepData } = req.body;
  
  const progress = await prisma.onboardingProgress.upsert({
    where: { userId: req.user.id },
    update: { currentStep, stepData },
    create: {
      userId: req.user.id,
      currentStep,
      stepData
    }
  });
  
  res.json(progress);
});

// Complete onboarding
router.post('/complete', authMiddleware, async (req, res) => {
  const data = req.body;
  
  // Update user profile
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name: data.profile?.name,
      avatar: data.profile?.avatar,
      onboardingCompleted: true
    }
  });
  
  // Create workspace if provided
  if (data.workspace) {
    await prisma.workspace.create({
      data: {
        name: data.workspace.name,
        slug: data.workspace.slug,
        ownerId: req.user.id
      }
    });
  }
  
  // Send team invites
  if (data.team?.invites?.length > 0) {
    // Send invite emails
  }
  
  res.json({ success: true });
});
```

## 🛡️ Onboarding Middleware

```javascript
// middleware/onboarding.js
export const requireOnboarding = async (req, res, next) => {
  if (!req.user.onboardingCompleted) {
    return res.redirect('/onboarding');
  }
  next();
};
```

## ❓ Need Help?

- [Framer Motion Documentation](https://www.framer.com/motion)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

