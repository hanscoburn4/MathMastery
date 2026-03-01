import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import DashboardLayout from './components/DashboardLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ClassesListPage from './pages/teacher/ClassesListPage';
import ClassDetailPage from './pages/teacher/ClassDetailPage';
import StudentProgressPage from './pages/teacher/StudentProgressPage';
import BulkScoreEntryPage from './pages/teacher/BulkScoreEntryPage';
import StudentPortal from './pages/student/StudentPortal';
import ParentPortal from './pages/parent/ParentPortal';

type AuthView = 'login' | 'register' | 'student-register';
type TeacherView = 'dashboard' | 'classes' | 'class-detail' | 'student-progress' | 'bulk-entry';

interface NavigationState {
  classId?: string;
  studentId?: string;
  className?: string;
  studentName?: string;
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [teacherView, setTeacherView] = useState<TeacherView>('dashboard');
  const [navState, setNavState] = useState<NavigationState>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setInvitationToken(token);
      setAuthView('student-register');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    if (authView === 'student-register' && invitationToken) {
      return (
        <StudentRegisterPage
          token={invitationToken}
          onSwitchToLogin={() => {
            setAuthView('login');
            setInvitationToken(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      );
    }

    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }

    return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
  }

  if (profile.role === 'student') {
    return <StudentPortal />;
  }

  if (profile.role === 'parent') {
    return <ParentPortal />;
  }

  function handleNavigate(view: TeacherView, data?: unknown) {
    const state = data as NavigationState | undefined;
    setTeacherView(view);
    if (state) {
      setNavState({ ...navState, ...state });
    }
  }

  function getBreadcrumbs(): { label: string; view?: TeacherView; data?: unknown }[] {
    const crumbs: { label: string; view?: TeacherView; data?: unknown }[] = [];

    if (teacherView === 'dashboard') {
      crumbs.push({ label: 'Dashboard' });
    } else if (teacherView === 'classes') {
      crumbs.push({ label: 'Dashboard', view: 'dashboard' });
      crumbs.push({ label: 'Classes' });
    } else if (teacherView === 'class-detail') {
      crumbs.push({ label: 'Dashboard', view: 'dashboard' });
      crumbs.push({ label: 'Classes', view: 'classes' });
      crumbs.push({ label: navState.className || 'Class' });
    } else if (teacherView === 'student-progress') {
      crumbs.push({ label: 'Dashboard', view: 'dashboard' });
      crumbs.push({ label: 'Classes', view: 'classes' });
      crumbs.push({
        label: navState.className || 'Class',
        view: 'class-detail',
        data: { classId: navState.classId }
      });
      crumbs.push({ label: navState.studentName || 'Student Progress' });
    } else if (teacherView === 'bulk-entry') {
      crumbs.push({ label: 'Dashboard', view: 'dashboard' });
      crumbs.push({ label: 'Classes', view: 'classes' });
      crumbs.push({
        label: navState.className || 'Class',
        view: 'class-detail',
        data: { classId: navState.classId }
      });
      crumbs.push({ label: 'Bulk Score Entry' });
    }

    return crumbs;
  }

  return (
    <DashboardLayout
      currentView={teacherView}
      onNavigate={handleNavigate}
      breadcrumbs={getBreadcrumbs()}
    >
      {teacherView === 'dashboard' && (
        <TeacherDashboard
          onNavigateToClasses={() => handleNavigate('classes')}
          onNavigateToClass={(classId) => handleNavigate('class-detail', { classId })}
        />
      )}

      {teacherView === 'classes' && (
        <ClassesListPage
          onNavigateToClass={(classId) => handleNavigate('class-detail', { classId })}
        />
      )}

      {teacherView === 'class-detail' && navState.classId && (
        <ClassDetailPage
          classId={navState.classId}
          onNavigateToStudentProgress={(classId, studentId) =>
            handleNavigate('student-progress', { classId, studentId })
          }
          onNavigateToBulkEntry={(classId) =>
            handleNavigate('bulk-entry', { classId })
          }
        />
      )}

      {teacherView === 'student-progress' && navState.classId && navState.studentId && (
        <StudentProgressPage
          classId={navState.classId}
          studentId={navState.studentId}
          onNavigateToStudent={(studentId) =>
            handleNavigate('student-progress', { classId: navState.classId, studentId })
          }
        />
      )}

      {teacherView === 'bulk-entry' && navState.classId && (
        <BulkScoreEntryPage
          classId={navState.classId}
          onBack={() => handleNavigate('class-detail', { classId: navState.classId })}
        />
      )}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}