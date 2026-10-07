import { lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { FloatingAgentChat } from '@/components/blocks';
import { GenesisAuth } from '@/lib/genesis-auth';
import { GenesisSection } from '@/lib/genesis';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const WeeklyActivitiesPage = lazy(() => import('@/pages/WeeklyActivitiesPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const SuperAdminPage = lazy(() => import('@/pages/SuperAdminPage'));

export default function App() {
  useEffect(() => {
    document.title = 'Activities | Hermiston High School';
  }, []);

  return (
    <GenesisAuth>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <GenesisSection name="Activities">
                <HomePage />
              </GenesisSection>
            }
          />
          <Route
            path="/activities/:activityId"
            element={
              <GenesisSection name="Activity">
                <ActivityPage />
              </GenesisSection>
            }
          />
          <Route
            path="/calendar"
            element={
              <GenesisSection name="Master calendar">
                <CalendarPage />
              </GenesisSection>
            }
          />
          <Route
            path="/weekly-activities"
            element={
              <GenesisSection name="Weekly activities">
                <WeeklyActivitiesPage />
              </GenesisSection>
            }
          />
          <Route
            path="/account"
            element={
              <GenesisSection name="Account access">
                <AccountPage />
              </GenesisSection>
            }
          />
          <Route
            path="/super-admin"
            element={
              <GenesisSection name="Super-admin controller">
                <SuperAdminPage />
              </GenesisSection>
            }
          />
        </Routes>
        <FloatingAgentChat
          agentId="01M3DED0CN4FZCHGC8CBEXP1J3"
          publicAgentId="hermiston-activities-guide-01M3DED0D8X988RQW6MP6AXF44"
          title="Activities Guide"
          accent={5}
          placeholder="Ask about activities..."
          suggestions={['Find a creative activity', 'Show me STEM options', 'What service opportunities are available?']}
        />
      </BrowserRouter>
    </GenesisAuth>
  );
}
