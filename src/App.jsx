import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Loader from './components/Loader';

// Lazy load all page components for code splitting
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TaskManager = lazy(() => import('./pages/TaskManager'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const HabitTracker = lazy(() => import('./pages/HabitTracker'));
const PrayerTracker = lazy(() => import('./pages/PrayerTracker'));
const BudgetTracker = lazy(() => import('./pages/BudgetTracker'));
const Notes = lazy(() => import('./pages/Notes'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader message="Authenticating..." />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader message="Authenticating..." />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loader message="Loading..." />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="tasks/projects/:projectId" element={<ProjectDetail />} />
          <Route path="tasks" element={<TaskManager />} />
          <Route path="habits" element={<HabitTracker />} />
          <Route path="prayers" element={<PrayerTracker />} />
          <Route path="budget" element={<BudgetTracker />} />
          <Route path="notes" element={<Notes />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
