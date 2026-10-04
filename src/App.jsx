import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import RequestEquipmentScreen from './screens/RequestEquipmentScreen'
import ConfirmationScreen from './screens/ConfirmationScreen'
import MyActivityScreen from './screens/MyActivityScreen'
import MyEquipmentScreen from './screens/MyEquipmentScreen'
import EquipmentFormScreen from './screens/EquipmentFormScreen'
import OwnerRequestsScreen from './screens/OwnerRequestsScreen'

function ProtectedRoute({ children }) {
  const { user, authReady } = useApp()
  if (!authReady) return null
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return <main className="app-shell"><Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<LoginScreen />} />
    <Route path="/home" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
    <Route path="/equipment/new" element={<ProtectedRoute><EquipmentFormScreen /></ProtectedRoute>} />
    <Route path="/my-equipment" element={<ProtectedRoute><MyEquipmentScreen /></ProtectedRoute>} />
    <Route path="/my-equipment/:equipmentId/edit" element={<ProtectedRoute><EquipmentFormScreen /></ProtectedRoute>} />
    <Route path="/my-equipment/requests" element={<ProtectedRoute><OwnerRequestsScreen /></ProtectedRoute>} />
    <Route path="/request/:equipmentId" element={<ProtectedRoute><RequestEquipmentScreen /></ProtectedRoute>} />
    <Route path="/confirmation/:requestId" element={<ProtectedRoute><ConfirmationScreen /></ProtectedRoute>} />
    <Route path="/activity" element={<ProtectedRoute><MyActivityScreen /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></main>
}