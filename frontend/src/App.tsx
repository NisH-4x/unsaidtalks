import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { refreshSession } from './api/client';
import { AdminLayout } from './features/admin/AdminLayout';
import { GroupCreatePage } from './features/admin/groups/GroupCreatePage';
import { GroupDetailPage } from './features/admin/groups/GroupDetailPage';
import { GroupsPage } from './features/admin/groups/GroupsPage';
import { MentorApplicationsPage } from './features/admin/MentorApplicationsPage';
import { ReportsPage } from './features/admin/reports/ReportsPage';
import { UsersPage } from './features/admin/users/UsersPage';
import { LoginPage } from './features/auth/LoginPage';
import { GuestOnly, RequireAuth, RequireRole } from './features/auth/RouteGuards';
import { SignupPage } from './features/auth/SignupPage';
import { ChatsLayout } from './features/chats/ChatsLayout';
import { ConversationPage } from './features/chats/ConversationPage';
import { NoConversationSelected } from './features/chats/NoConversationSelected';
import { AppShell } from './features/shell/AppShell';
import { NotFoundPage } from './features/shell/NotFoundPage';
import { SplashScreen } from './features/shell/SplashScreen';
import { useAuthStore } from './store/auth.store';

export default function App() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    void refreshSession();
  }, []);

  if (status === 'restoring') return <SplashScreen />;

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route element={<ChatsLayout />}>
            <Route index element={<NoConversationSelected />} />
            <Route path="chats/:conversationId" element={<ConversationPage />} />
          </Route>

          <Route path="admin" element={<RequireRole role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="groups" replace />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="groups/new" element={<GroupCreatePage />} />
              <Route path="groups/:groupId" element={<GroupDetailPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="mentor-requests" element={<MentorApplicationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
