import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LoadingScreen from './components/ui/LoadingScreen'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import PrescriptionsPage from './pages/PrescriptionsPage'
import CreatePrescriptionPage from './pages/CreatePrescriptionPage'
import PrescriptionDetailsPage from './pages/PrescriptionDetailsPage'
import PatientsPage from './pages/PatientsPage'
import PatientDetailsPage from './pages/PatientDetailsPage'
import MedicationsPage from './pages/MedicationsPage'
import MedicationSchedulePage from './pages/MedicationSchedulePage'
import AIReviewPage from './pages/AIReviewPage'
import AnalyticsPage from './pages/AnalyticsPage'
import NotificationsPage from './pages/NotificationsPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="prescriptions/new" element={<CreatePrescriptionPage />} />
        <Route path="prescriptions/:id" element={<PrescriptionDetailsPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailsPage />} />
        <Route path="medications" element={<MedicationsPage />} />
        <Route path="schedule" element={<MedicationSchedulePage />} />
        <Route path="ai-review" element={<AIReviewPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
