import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Mail, Search, Trash2, UserPlus } from 'lucide-react';
import type { Profile, ParentStudentLink } from '../types/database';

interface ParentLinkModalProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ParentLinkModal({ studentId, studentName, onClose, onUpdate }: ParentLinkModalProps) {
  const [linkedParents, setLinkedParents] = useState<Profile[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchLinkedParents();
  }, [studentId]);

  async function fetchLinkedParents() {
    setLoading(true);
    const { data: links } = await supabase
      .from('parent_student_links')
      .select('parent_id')
      .eq('student_id', studentId);

    if (links && links.length > 0) {
      const parentIds = links.map(l => l.parent_id);
      const { data: parents } = await supabase
        .from('profiles')
        .select('*')
        .in('id', parentIds);

      setLinkedParents(parents || []);
    }
    setLoading(false);
  }

  async function handleSearch() {
    if (!searchEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    setSearching(true);
    setError('');
    setSearchResults([]);

    const { data, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', searchEmail.trim().toLowerCase())
      .eq('role', 'parent')
      .maybeSingle();

    setSearching(false);

    if (searchError) {
      setError('Error searching for parent');
      return;
    }

    if (!data) {
      setError('No parent account found with that email. The parent needs to create an account first.');
      return;
    }

    const isAlreadyLinked = linkedParents.some(p => p.id === data.id);
    if (isAlreadyLinked) {
      setError('This parent is already linked to this student');
      return;
    }

    setSearchResults([data]);
  }

  async function handleLinkParent(parentId: string) {
    setError('');
    const { error: linkError } = await supabase
      .from('parent_student_links')
      .insert({
        parent_id: parentId,
        student_id: studentId
      });

    if (linkError) {
      setError('Failed to link parent: ' + linkError.message);
      return;
    }

    setSearchEmail('');
    setSearchResults([]);
    await fetchLinkedParents();
    onUpdate();
  }

  async function handleUnlinkParent(parentId: string) {
    const { error: unlinkError } = await supabase
      .from('parent_student_links')
      .delete()
      .eq('parent_id', parentId)
      .eq('student_id', studentId);

    if (unlinkError) {
      setError('Failed to unlink parent: ' + unlinkError.message);
      return;
    }

    await fetchLinkedParents();
    onUpdate();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Manage Parent Access</h2>
            <p className="text-sm text-slate-600 mt-1">Student: {studentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <h3 className="font-medium text-slate-900 mb-3">Add Parent</h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter parent's email address"
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {searching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-3 border border-slate-200 rounded-lg p-4">
                {searchResults.map(parent => (
                  <div key={parent.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{parent.full_name || 'Unnamed Parent'}</p>
                      <p className="text-sm text-slate-600">{parent.email}</p>
                    </div>
                    <button
                      onClick={() => handleLinkParent(parent.id)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Link Parent
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-3">
              Linked Parents ({linkedParents.length})
            </h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : linkedParents.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                No parents linked yet
              </div>
            ) : (
              <div className="space-y-2">
                {linkedParents.map(parent => (
                  <div
                    key={parent.id}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <Mail className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{parent.full_name || 'Unnamed Parent'}</p>
                        <p className="text-sm text-slate-600">{parent.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkParent(parent.id)}
                      className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
