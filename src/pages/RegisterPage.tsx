import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, GraduationCap, Users, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

type RegistrationStep = 'role-select' | 'register' | 'success';

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [step, setStep] = useState<RegistrationStep>('role-select');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  function handleRoleSelect(role: UserRole) {
    setSelectedRole(role);
    setStep('register');
  }

  function handleBack() {
    setStep('role-select');
    setSelectedRole(null);
  }

  if (step === 'role-select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
              <p className="text-slate-600 mt-2">Choose your account type</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleRoleSelect('teacher')}
                className="p-6 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-200 transition-colors">
                  <GraduationCap className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Teacher</h3>
                <p className="text-sm text-slate-600">Create classes and track student progress</p>
              </button>

              <button
                onClick={() => handleRoleSelect('student')}
                className="p-6 border-2 border-slate-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors">
                  <UserPlus className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Student</h3>
                <p className="text-sm text-slate-600">Join a class and view your progress</p>
              </button>

              <button
                onClick={() => handleRoleSelect('parent')}
                className="p-6 border-2 border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-200 transition-colors">
                  <Users className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Parent</h3>
                <p className="text-sm text-slate-600">View your child's progress</p>
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-slate-600 text-sm">
                Already have an account?{' '}
                <button
                  onClick={onSwitchToLogin}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'register' && selectedRole) {
    return (
      <RegistrationForm
        role={selectedRole}
        onBack={handleBack}
        onSwitchToLogin={onSwitchToLogin}
        onSuccess={() => setStep('success')}
      />
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h2>
            <p className="text-slate-600 mb-6">
              Your account has been created successfully. You can now sign in.
            </p>
            <button
              onClick={onSwitchToLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

interface RegistrationFormProps {
  role: UserRole;
  onBack: () => void;
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}

function RegistrationForm({ role, onBack, onSwitchToLogin, onSuccess }: RegistrationFormProps) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [classCode, setClassCode] = useState('');
  const [classInfo, setClassInfo] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);

  async function validateClassCode(code: string) {
    if (code.length !== 6) {
      setClassInfo(null);
      return;
    }

    setValidatingCode(true);
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('class_code', code.toUpperCase())
      .maybeSingle();

    setValidatingCode(false);

    if (error || !data) {
      setClassInfo(null);
      return;
    }

    setClassInfo(data);
  }

  function handleClassCodeChange(value: string) {
    const upperValue = value.toUpperCase();
    setClassCode(upperValue);
    if (upperValue.length === 6) {
      validateClassCode(upperValue);
    } else {
      setClassInfo(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (role === 'student' && !classInfo) {
      setError('Please enter a valid class code');
      return;
    }

    setLoading(true);

    const { data: authData, error: signUpError } = await signUp(email, password, fullName, role);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (role === 'student' && classInfo && authData?.user) {
      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          class_id: classInfo.id,
          student_id: authData.user.id
        });

      if (enrollError) {
        setError('Account created but failed to join class. Please contact your teacher.');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onSuccess();
  }

  const roleInfo = {
    teacher: {
      icon: <GraduationCap className="w-8 h-8 text-white" />,
      title: 'Create Teacher Account',
      description: 'Create classes and track student progress'
    },
    student: {
      icon: <UserPlus className="w-8 h-8 text-white" />,
      title: 'Create Student Account',
      description: 'Join a class using your class code'
    },
    parent: {
      icon: <Users className="w-8 h-8 text-white" />,
      title: 'Create Parent Account',
      description: 'Your teacher will link you to your child'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              {roleInfo[role].icon}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{roleInfo[role].title}</h1>
            <p className="text-slate-600 mt-2">{roleInfo[role].description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {role === 'student' && (
              <div>
                <label htmlFor="classCode" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Class Code
                </label>
                <input
                  id="classCode"
                  type="text"
                  value={classCode}
                  onChange={(e) => handleClassCodeChange(e.target.value)}
                  required
                  maxLength={6}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors uppercase font-mono"
                  placeholder="ABC123"
                />
                {validatingCode && (
                  <p className="text-sm text-slate-500 mt-1">Validating code...</p>
                )}
                {classInfo && (
                  <p className="text-sm text-green-600 mt-1">
                    Joining: {classInfo.name}
                  </p>
                )}
                {classCode.length === 6 && !classInfo && !validatingCode && (
                  <p className="text-sm text-red-600 mt-1">Invalid class code</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || (role === 'student' && !classInfo)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
