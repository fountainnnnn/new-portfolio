import { Navigate, Routes, Route } from 'react-router-dom';
import RLLabPage from './pages/RLLabPage';
import ReportsPage from './pages/ReportsPage';
import ExportsPage from './pages/ExportsPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RLLabPage />} />
      <Route path="/agent-hardening" element={<Navigate to="/" replace />} />
      <Route path="/rl-lab" element={<RLLabPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/exports" element={<ExportsPage />} />
    </Routes>
  );
}
