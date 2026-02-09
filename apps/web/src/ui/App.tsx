import { Navigate, Route, Routes } from "react-router-dom";
import { BoardPage } from "./BoardPage";
import { AuthPage } from "./AuthPage";
import { useAuth } from "../state/auth";

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page">Checking your session…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/board" replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/board"
        element={user ? <BoardPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
