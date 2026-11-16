import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  User,
  Phone,
  Mail,
  Shield,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Compass,
  Bell,
  HeartHandshake,
  AlertTriangle
} from 'lucide-react';

export default function ProfilePage() {
  const { user, helperProfile, refreshUser } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Family');

  const [helperCategories, setHelperCategories] = useState(['accident', 'puncture', 'stranded']);
  const [wantsSafety, setWantsSafety] = useState(true);
  const [applyingHelper, setApplyingHelper] = useState(false);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/users/me/emergency-contacts');
      setContacts(res.data.contacts || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) {
      alert('Name and mobile number are required.');
      return;
    }

    try {
      await api.post('/users/me/emergency-contacts', {
        name: newContactName,
        phone: newContactPhone,
        relationship: newContactRelation
      });
      setNewContactName('');
      setNewContactPhone('');
      fetchContacts();
      refreshUser();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not add contact.');
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/users/me/emergency-contacts/${contactId}`);
      fetchContacts();
      refreshUser();
    } catch (e) {
      alert('Could not remove contact.');
    }
  };

  const handleApplyHelper = async () => {
    setApplyingHelper(true);
    try {
      await api.post('/helpers/apply', {
        categories: helperCategories,
        wantsSafetyEligible: wantsSafety,
        simulatedIdType: 'Government Driving License (Simulated Prototype)',
        notes: 'Volunteer application submitted for local neighborhood assistance'
      });
      alert('Helper application submitted! Awaiting admin approval.');
      refreshUser();
    } catch (e) {
      alert('Failed to submit helper application.');
    } finally {
      setApplyingHelper(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">You are not signed in</h2>
        <p className="text-xs text-slate-500">Sign in with your account or register with your details to manage your profile and emergency contacts.</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link to="/login" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow">
            Sign In
          </Link>
          <Link to="/register" className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow">
            Register Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Profile Overview */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 overflow-hidden border-2 border-slate-200 flex-shrink-0">
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-center sm:text-left space-y-1">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h1 className="text-2xl font-black text-slate-900">{user?.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold capitalize">
              {user?.role === 'admin' ? 'Administrator' : (user?.isHelper ? 'Volunteer Helper' : 'Requester')}
            </span>
          </div>
          <p className="text-xs text-slate-500">{user?.email} • {user?.phone}</p>
          {(user?.idLast4 || user?.verificationId) && (
            <p className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg inline-block mt-1 border border-emerald-200">
              Verified ID: {user.idLast4 || user.verificationId} ({user.idType || 'Government ID'})
            </p>
          )}
        </div>
      </div>

      {/* EMERGENCY CONTACTS MANAGER (MAX 6) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-600" />
              <span>Emergency Contacts Manager</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These contacts are automatically alerted whenever you trigger an Emergency SOS.
            </p>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {contacts.length} / 6 Contacts
          </span>
        </div>

        {/* Existing Contacts List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contacts.map(c => (
            <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 block">{c.name}</span>
                <span className="text-[11px] text-slate-500 font-mono">{c.phone} • {c.relationship}</span>
              </div>
              <button
                onClick={() => handleDeleteContact(c.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove contact"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Contact Form (enforces max 6) */}
        {contacts.length < 6 ? (
          <form onSubmit={handleAddContact} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">Add New Emergency Contact</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Full Name (e.g. Papa)"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="p-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500"
                required
              />
              <input
                type="tel"
                placeholder="+91 Mobile Number"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                className="p-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 font-mono"
                required
              />
              <select
                value={newContactRelation}
                onChange={(e) => setNewContactRelation(e.target.value)}
                className="p-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500"
              >
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Spouse">Spouse</option>
                <option value="Friend">Friend</option>
                <option value="Doctor">Doctor</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Save Contact</span>
            </button>
          </form>
        ) : (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
            Maximum limit of 6 emergency contacts reached. Remove a contact before adding a new one.
          </div>
        )}
      </div>

      {/* HELPER APPLICATION & VERIFICATION STATUS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-600" />
              <span>Community Helper Status & Verification</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Become a verified local volunteer to assist neighbors in distress.
            </p>
          </div>
          {helperProfile && (
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              helperProfile.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {helperProfile.status}
            </span>
          )}
        </div>

        {helperProfile ? (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Application Status:</span>
              <span className="font-extrabold capitalize text-emerald-700">{helperProfile.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Safety Request Certification:</span>
              <span className="font-extrabold text-purple-700">
                {helperProfile.safetyEligible ? 'Verified for Personal Safety SOS ✓' : 'General Assistance Only'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Simulated ID Verification:</span>
              <span className="text-slate-600">{helperProfile.verification?.simulatedIdType || 'Verified ID (Prototype)'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Apply to join Help Radius volunteer network. You will be able to toggle "Available to help" and respond to alerts in your radius.
            </p>

            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsSafety}
                  onChange={(e) => setWantsSafety(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-xs font-bold text-purple-900">
                  I wish to help with high-priority Personal Safety requests (requires Admin background verification)
                </span>
              </label>
            </div>

            <button
              onClick={handleApplyHelper}
              disabled={applyingHelper}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow"
            >
              {applyingHelper ? 'Submitting Application...' : 'Apply to Become a Helper (Prototype)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
