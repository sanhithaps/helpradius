import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  User,
  Mail,
  Lock,
  Phone,
  ShieldCheck,
  Compass,
  ArrowRight,
  CheckCircle2,
  MapPin,
  HeartHandshake,
  UserCheck,
  ShieldAlert,
  Flame,
  HeartPulse,
  Wrench,
  Car,
  IdCard,
  CreditCard
} from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('Please enter your registered email address or mobile phone number.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      await login(identifier.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || 'Login failed. Please verify your email/phone and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center mx-auto shadow-md shadow-rose-600/30">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sign In to Help Radius</h1>
        <p className="text-xs text-slate-500">
          Enter your registered email ID and password to access your dashboard
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Email Address or Mobile Number
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="your.email@example.com or +919876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full p-3.5 pl-11 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all font-medium"
                required
              />
              <User className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 pl-11 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all font-medium"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>Verifying Credentials...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-3 text-center text-xs text-slate-500 border-t border-slate-100">
          First time here?{' '}
          <Link to="/register" className="font-extrabold text-rose-600 hover:text-rose-700 hover:underline">
            Register your account &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register, userLocation } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Step 1: Personal Profile & Verification ID
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [idType, setIdType] = useState('Aadhaar Card');
  const [verificationId, setVerificationId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState(userLocation?.address || '');
  const [accountType, setAccountType] = useState('user'); // 'user' (Requester) or 'helper' (Volunteer)

  useEffect(() => {
    if ((!address || address === 'Acquiring live device GPS...') && userLocation?.address && userLocation.address !== 'Acquiring live device GPS...') {
      setAddress(userLocation.address);
    }
  }, [userLocation?.address]);

  // Step 2: Emergency Contact & Volunteer Specifics
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('+91');
  const [contactRelation, setContactRelation] = useState('Parent');

  // Helper categories (if accountType === 'helper')
  const [selectedCategories, setSelectedCategories] = useState([
    'accident',
    'health',
    'personal_safety',
    'puncture',
    'roadside'
  ]);

  // Step 3: Device Permissions & Confirm
  const [locationConsent, setLocationConsent] = useState(true);
  const [notifConsent, setNotifConsent] = useState(true);

  const toggleCategory = (catId) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleStep1Next = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!phone.trim() || phone.trim() === '+91') {
      setErrorMessage('Please enter your mobile phone number.');
      return;
    }
    if (!verificationId.trim()) {
      setErrorMessage('Please enter your Verification ID number (e.g. Aadhaar / Voter ID / Student ID).');
      return;
    }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!password || !passwordRegex.test(password)) {
      setErrorMessage('Password must be at least 8 characters long and contain at least one letter and one number.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setErrorMessage('');
    setStep(2);
  };

  const handleStep2Next = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setStep(3);
  };

  const handleRegister = async () => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const emergencyContacts = contactName.trim() && contactPhone.trim() && contactPhone.trim() !== '+91' ? [
        {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relationship: contactRelation
        }
      ] : [];

      await register({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        verificationId: verificationId.trim(),
        idType,
        password,
        address: address.trim(),
        role: accountType,
        isHelper: accountType === 'helper',
        helperCategories: accountType === 'helper' ? selectedCategories : [],
        emergencyContacts,
        permissions: {
          locationGranted: locationConsent,
          notificationsGranted: notifConsent
        },
        location: {
          lat: userLocation?.lat ?? null,
          lng: userLocation?.lng ?? null,
          address: address.trim() || userLocation?.address || 'Current Location'
        }
      });

      navigate('/dashboard');
    } catch (e) {
      setErrorMessage(e.response?.data?.message || 'Registration failed. Please check details and try again.');
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Help Radius Registration
        </h1>
        <p className="text-xs text-slate-500">
          Enter your personal and verification details to create and verify your account
        </p>

        {/* Stepper HUD */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            step === 1 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            <span>1</span>
            <span>Profile & ID</span>
          </div>
          <div className="w-4 h-0.5 bg-slate-200" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            step === 2 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            <span>2</span>
            <span>{accountType === 'helper' ? 'Volunteer Setup' : 'Emergency Contact'}</span>
          </div>
          <div className="w-4 h-0.5 bg-slate-200" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            step === 3 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            <span>3</span>
            <span>Confirmation</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: PERSONAL DETAILS, ID VERIFICATION & ROLE */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-5">
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                I am registering as:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('user')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                    accountType === 'user'
                      ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    accountType === 'user' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 block">Community Requester</span>
                    <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                      Seek Emergency SOS, roadside flat tyre help, and companion assistance.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('helper')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                    accountType === 'helper'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    accountType === 'helper' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 block">Volunteer / First-Responder</span>
                    <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                      Respond to nearby alerts in your radius and assist people in distress.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your full legal name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3.5 pl-10 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500"
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="yourname@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3.5 pl-10 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500"
                    required
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>
            </div>

            {/* Mobile Number & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3.5 pl-10 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500 font-mono"
                    required
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  City / Locality Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Current street, neighborhood or city"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3.5 pl-10 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>
            </div>

            {/* VERIFICATION ID SECTION (REQUIRED) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <IdCard className="w-5 h-5 text-rose-600" />
                <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Identity Verification ID Details *
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Required for safety verification and emergency accountability.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    ID Document Type
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 bg-white font-medium"
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID Card">Voter ID Card</option>
                    <option value="College / Student ID">College / Student ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Government Employee ID">Government Employee ID</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Verification ID Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1234-5678-9012 or DL-12345"
                    value={verificationId}
                    onChange={(e) => setVerificationId(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-500">
                <input type="checkbox" defaultChecked required className="mt-0.5 rounded text-rose-600 focus:ring-rose-500" />
                <span>My ID is used only for manual helper verification; only the last 4 digits are stored.</span>
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Create Password *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Min 8 chars (letters & numbers)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3.5 pl-10 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3.5 pl-10 rounded-2xl border border-slate-200 text-sm outline-none focus:border-rose-500"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Continue to Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: SAFETY CONTACTS & VOLUNTEER CAPABILITIES */}
        {step === 2 && (
          <form onSubmit={handleStep2Next} className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Primary Emergency Contact (Notified during SOS)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Enter your real family or friend contact. This contact will be automatically broadcast whenever you trigger Emergency SOS.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh (Father)"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Relationship</label>
                  <select
                    value={contactRelation}
                    onChange={(e) => setContactRelation(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Spouse">Spouse / Partner</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend / Roommate</option>
                    <option value="Doctor">Family Doctor</option>
                    <option value="Colleague">Colleague</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Volunteer Specializations (if helper) */}
            {accountType === 'helper' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 block">Volunteer Rescue Capabilities</span>
                    <span className="text-xs text-slate-500">Categories you are equipped to assist with in your radius</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'accident', name: 'Road Accidents', icon: Flame },
                    { id: 'health', name: 'Medical / CPR', icon: HeartPulse },
                    { id: 'personal_safety', name: 'Safety Escort', icon: UserCheck },
                    { id: 'physical_danger', name: 'Physical Danger', icon: ShieldAlert },
                    { id: 'puncture', name: 'Tyre Puncture', icon: Wrench },
                    { id: 'roadside', name: 'Vehicle Tow/Jump', icon: Car }
                  ].map(cat => (
                    <label
                      key={cat.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-xs font-semibold ${
                        selectedCategories.includes(cat.id)
                          ? 'border-emerald-500 bg-white text-emerald-900 shadow-sm'
                          : 'border-slate-200 text-slate-600 bg-white/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                        className="rounded text-emerald-600"
                      />
                      <cat.icon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3.5 px-6 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Continue to Confirmation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: CONFIRMATION & DEVICE CONSENTS */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase block">Account Summary</span>
              <div className="text-xs text-slate-600 space-y-1">
                <div><strong>Full Name:</strong> {name}</div>
                <div><strong>Email:</strong> {email}</div>
                <div><strong>Mobile:</strong> {phone}</div>
                <div><strong>Verification ID:</strong> {`XXXX-XXXX-${verificationId.slice(-4)}`} ({idType})</div>
                <div><strong>Account Role:</strong> {accountType === 'helper' ? 'Volunteer Helper' : 'Community Requester'}</div>
                <div><strong>Primary Emergency Contact:</strong> {contactName ? `${contactName} (${contactPhone}) - ${contactRelation}` : 'None added (can add anytime in Profile)'}</div>
              </div>
            </div>

            {/* Permissions */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase block">Required Device Permissions</span>
              
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(e) => setLocationConsent(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600"
                />
                <span className="text-slate-700">
                  <strong>Precise GPS Geofencing:</strong> Grant permission to calculate distance and dynamic radius expansion for live assistance.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={notifConsent}
                  onChange={(e) => setNotifConsent(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600"
                />
                <span className="text-slate-700">
                  <strong>Emergency Alerts & Notifications:</strong> Receive incoming requests, helper dispatch updates, and private tracking signals.
                </span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-3.5 px-6 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleRegister}
                disabled={submitting}
                className="flex-1 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span>Registering Account in Database...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Complete Registration & Open Dashboard</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
          Already registered?{' '}
          <Link to="/login" className="font-extrabold text-rose-600 hover:text-rose-700 hover:underline">
            Sign In with Email & Password &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
