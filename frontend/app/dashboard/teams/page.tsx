'use client';

import { useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Mail,
  MoreHorizontal,
  Shield,
  Trash2,
  UserMinus,
  Crown,
} from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending';
  joinedAt: string;
}

const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    avatar: 'SC',
    role: 'owner',
    status: 'active',
    joinedAt: 'Jan 2024',
  },
  {
    id: '2',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    avatar: 'MJ',
    role: 'admin',
    status: 'active',
    joinedAt: 'Feb 2024',
  },
  {
    id: '3',
    name: 'Emily Davis',
    email: 'emily@example.com',
    avatar: 'ED',
    role: 'member',
    status: 'active',
    joinedAt: 'Mar 2024',
  },
  {
    id: '4',
    name: 'alex@example.com',
    email: 'alex@example.com',
    avatar: 'AR',
    role: 'member',
    status: 'pending',
    joinedAt: 'Pending',
  },
];

export default function TeamsPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleInvite = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    console.log('Inviting:', { email: inviteEmail, role: inviteRole });
    setInviteEmail('');
    setShowInviteModal(false);
  }, [inviteEmail, inviteRole]);

  const handleRemoveMember = useCallback((memberId: string) => {
    console.log('Removing member:', memberId);
    setActiveDropdown(null);
  }, []);

  const handleChangeRole = useCallback((memberId: string, newRole: string) => {
    console.log('Changing role:', { memberId, newRole });
    setActiveDropdown(null);
  }, []);

  const toggleDropdown = useCallback((memberId: string) => {
    setActiveDropdown(prev => prev === memberId ? null : memberId);
  }, []);

  const openInviteModal = useCallback(() => {
    setShowInviteModal(true);
  }, []);

  const closeInviteModal = useCallback(() => {
    setShowInviteModal(false);
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteEmail(e.target.value);
  }, []);

  const handleRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setInviteRole(e.target.value as 'admin' | 'member');
  }, []);

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: TeamMember['role']) => {
    const styles = {
      owner: 'bg-yellow-100 text-yellow-700',
      admin: 'bg-blue-100 text-blue-700',
      member: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${styles[role]}`}>
        {role}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            <p className="text-gray-600 mt-1">
              Manage your team and their permissions
            </p>
          </div>
          <button
            onClick={openInviteModal}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Invite Member
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {teamMembers.filter(m => m.status === 'active').length}
                </p>
                <p className="text-sm text-gray-500">Active Members</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {teamMembers.filter(m => m.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-500">Pending Invites</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {teamMembers.filter(m => m.role === 'admin' || m.role === 'owner').length}
                </p>
                <p className="text-sm text-gray-500">Admins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team List */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">All Members</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {teamMembers?.length > 0 ? (
              teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                      {member.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{member.name}</p>
                        {getRoleIcon(member.role)}
                      </div>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getRoleBadge(member.role)}
                    {member.status === 'pending' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        Pending
                      </span>
                    )}
                    <span className="text-sm text-gray-500">{member.joinedAt}</span>
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown(member.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5 text-gray-400" />
                      </button>
                      {activeDropdown === member.id && member.role !== 'owner' && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                          <button
                            onClick={() => handleChangeRole(member.id, 'admin')}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Shield className="w-4 h-4" />
                            Make Admin
                          </button>
                          <button
                            onClick={() => handleChangeRole(member.id, 'member')}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <UserMinus className="w-4 h-4" />
                            Make Member
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No team members yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md animate-scale-in">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Team Member</h2>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={handleEmailChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={handleRoleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeInviteModal}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
                  >
                    Send Invite
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

