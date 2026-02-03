import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';

interface AdminAddStudentModalProps {
  classId: string;
  onClose: () => void;
  onAdded: () => void;
}

interface StudentCredentials {
  id: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
}

export default function AdminAddStudentModal({
  classId,
  onClose,
  onAdded
}: AdminAddStudentModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add_student`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            fullName,
            email: email.toLowerCase(),
            classId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to add student');
        setAdding(false);
        return;
      }

      setCredentials(data.student);
      setAdding(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setAdding(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleDone() {
    onAdded();
    onClose();
  }

  if (credentials) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-md p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Student Added!</h2>
            <p className="text-sm text-slate-600 mt-1">
              Share these credentials with the student
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={credentials.email}
                      readOnly
                      className="flex-1 text-sm px-3 py-2 bg-white border border-slate-300 rounded"
                    />
                    <button
                      onClick={() => copyToClipboard(credentials.email, 'email')}
                      className="p-2 hover:bg-slate-200 rounded text-slate-600"
                    >
                      {copiedField === 'email' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Temporary Password
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={credentials.temporaryPassword}
                      readOnly
                      className="flex-1 text-sm px-3 py-2 bg-white border border-slate-300 rounded font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(credentials.temporaryPassword, 'password')}
                      className="p-2 hover:bg-slate-200 rounded text-slate-600"
                    >
                      {copiedField === 'password' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                The student should change their password on first login. Share these credentials securely.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                copyToClipboard(
                  `Email: ${credentials.email}\nPassword: ${credentials.temporaryPassword}`,
                  'both'
                );
              }}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm"
            >
              {copiedField === 'both' ? 'Copied!' : 'Copy Both'}
            </button>
            <button
              onClick={handleDone}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Add Student</h2>
          <p className="text-sm text-slate-600 mt-1">
            Create a new student account and enroll in this class
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name *
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Alex Johnson"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="student@example.com"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-600">
              A temporary password will be generated automatically. The student can log in immediately and change their password.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
