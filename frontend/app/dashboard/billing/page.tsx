'use client';

import { useState, useCallback } from 'react';
import { Check, CreditCard, Download, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 9,
    interval: 'month',
    description: 'Perfect for getting started',
    features: [
      '5 team members',
      '10 projects',
      '5GB storage',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    interval: 'month',
    description: 'Best for growing teams',
    features: [
      '25 team members',
      'Unlimited projects',
      '100GB storage',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
      'API access',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    description: 'For large organizations',
    features: [
      'Unlimited team members',
      'Unlimited projects',
      'Unlimited storage',
      'Custom analytics',
      '24/7 phone support',
      'Custom integrations',
      'API access',
      'SLA guarantee',
      'Dedicated manager',
    ],
  },
];

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
}

const invoices: Invoice[] = [
  { id: 'INV-001', date: 'Dec 1, 2024', amount: '$29.00', status: 'paid' },
  { id: 'INV-002', date: 'Nov 1, 2024', amount: '$29.00', status: 'paid' },
  { id: 'INV-003', date: 'Oct 1, 2024', amount: '$29.00', status: 'paid' },
  { id: 'INV-004', date: 'Sep 1, 2024', amount: '$29.00', status: 'paid' },
];

export default function BillingPage() {
  const [currentPlan] = useState('pro');
  const [isAnnual, setIsAnnual] = useState(false);

  const handleUpgrade = useCallback((planId: string) => {
    console.log('Upgrading to plan:', planId);
    // Implement Stripe checkout
  }, []);

  const handleDownloadInvoice = useCallback((invoiceId: string) => {
    console.log('Downloading invoice:', invoiceId);
  }, []);

  const toggleBilling = useCallback(() => {
    setIsAnnual(prev => !prev);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="text-gray-600 mt-1">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Current Plan */}
        <div className="bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm">Current Plan</p>
              <h2 className="text-2xl font-bold mt-1">Pro Plan</h2>
              <p className="text-primary-100 mt-2">
                Your next billing date is January 1, 2025
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">$29</p>
              <p className="text-primary-100">/month</p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900">•••• •••• •••• 4242</p>
                <p className="text-sm text-gray-500">Expires 12/2025</p>
              </div>
            </div>
            <button className="text-primary-500 hover:text-primary-600 font-medium text-sm">
              Update
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Available Plans</h3>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={toggleBilling}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={toggleBilling}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Annual
                <span className="ml-1 text-xs text-green-600">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans?.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-6 transition-all ${
                  plan.id === currentPlan
                    ? 'border-primary-500 bg-primary-50/50'
                    : 'border-gray-100 hover:border-gray-200'
                } ${plan.popular ? 'shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ${isAnnual ? Math.round(plan.price * 0.8) : plan.price}
                    </span>
                    <span className="text-gray-500">/{plan.interval}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features?.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.id === currentPlan}
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    plan.id === currentPlan
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {plan.id === currentPlan ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Invoice History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {invoices?.length > 0 ? (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{invoice.id}</p>
                      <p className="text-sm text-gray-500">{invoice.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-900">{invoice.amount}</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : invoice.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {invoice.status}
                    </span>
                    <button
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No invoices yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

