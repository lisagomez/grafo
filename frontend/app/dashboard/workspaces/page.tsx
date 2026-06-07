'use client';

import { useState, useCallback } from 'react';
import { Building2, Plus, Settings, Users, ExternalLink, MoreHorizontal, Check } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useWorkspace } from '../../providers';

interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  plan: 'basic' | 'pro' | 'enterprise';
  membersCount: number;
  projectsCount: number;
  createdAt: string;
  isCurrent: boolean;
}

const workspacesData: WorkspaceData[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    plan: 'pro',
    membersCount: 12,
    projectsCount: 8,
    createdAt: 'Jan 2024',
    isCurrent: true,
  },
  {
    id: '2',
    name: 'Side Project',
    slug: 'side-project',
    plan: 'basic',
    membersCount: 2,
    projectsCount: 3,
    createdAt: 'Mar 2024',
    isCurrent: false,
  },
  {
    id: '3',
    name: 'Client Work',
    slug: 'client-work',
    plan: 'pro',
    membersCount: 5,
    projectsCount: 12,
    createdAt: 'Feb 2024',
    isCurrent: false,
  },
];

export default function WorkspacesPage() {
  const { switchWorkspace } = useWorkspace();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleCreateWorkspace = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating workspace:', newWorkspaceName);
    setNewWorkspaceName('');
    setShowCreateModal(false);
  }, [newWorkspaceName]);

  const handleSwitchWorkspace = useCallback((workspaceId: string) => {
    console.log('Switching to workspace:', workspaceId);
    switchWorkspace(workspaceId);
  }, [switchWorkspace]);

  const toggleDropdown = useCallback((workspaceId: string) => {
    setActiveDropdown(prev => prev === workspaceId ? null : workspaceId);
  }, []);

  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWorkspaceName(e.target.value);
  }, []);

  const getPlanBadge = (plan: WorkspaceData['plan']) => {
    const styles = {
      basic: 'bg-gray-100 text-gray-700',
      pro: 'bg-primary-100 text-primary-700',
      enterprise: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${styles[plan]}`}>
        {plan}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
            <p className="text-gray-600 mt-1">
              Manage your workspaces and switch between them
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Workspace
          </button>
        </div>

        {/* Workspaces Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspacesData?.length > 0 ? (
            workspacesData.map((workspace) => (
              <div
                key={workspace.id}
                className={`bg-white rounded-xl border-2 transition-all hover:shadow-lg ${
                  workspace.isCurrent
                    ? 'border-primary-500 ring-2 ring-primary-100'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xl font-bold">
                      {workspace.name.charAt(0)}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown(workspace.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5 text-gray-400" />
                      </button>
                      {activeDropdown === workspace.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                          <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Settings
                          </button>
                          <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Manage Members
                          </button>
                          <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            View Dashboard
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{workspace.name}</h3>
                      {workspace.isCurrent && (
                        <span className="flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">/{workspace.slug}</p>
                  </div>

                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {workspace.membersCount} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {workspace.projectsCount} projects
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    {getPlanBadge(workspace.plan)}
                    {!workspace.isCurrent && (
                      <button
                        onClick={() => handleSwitchWorkspace(workspace.id)}
                        className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                      >
                        Switch to this
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No workspaces yet</p>
              <button
                onClick={openCreateModal}
                className="mt-4 text-primary-500 hover:text-primary-600 font-medium"
              >
                Create your first workspace
              </button>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md animate-scale-in">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Workspace</h2>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={handleNameChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="My Workspace"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This will be used as your workspace identifier
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

