import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LandingLayout from "./components/Layout/LandingLayout";
import DashboardLayout from "./components/Layout/DashboardLayout";
import {
  DashboardIndex,
  SessionsPage,
  TasksPage,
  SubmissionsPage,
  ReviewsPage,
  ExternalCoursesPage,
  UsersPage,
  StudentProfilesPage,
  ChildDetailsPage,
  ProgressPage,
  ExamsPage,
  MessagesPage,
  ChannelsPage,
  AnnouncementsPage,
  AuditLogsPage,
  AccountProfilePage,
  WeeklySchedulePage,
  LeaderboardPage,
  ChallengesPage,
  InstructorChallengesPage,
  NotificationsPage,
  LessonViewPage,
  AchievementsPage,
  CanvasPage,
  CanvasBoardPage,
} from "./routes/dashboardPages";
import { SocketProvider } from "./context/SocketContext";
import PageLoader from "./components/Loading/PageLoader";

/* Every route is code-split. Loading all thirty pages (plus three.js, recharts
   and socket.io) up front was a ~1.1 MB single chunk that every visitor paid
   for just to read the home page. */
const Auth = lazy(() => import("./components/Auth/Auth"));
const AccountPending = lazy(() => import("./components/Auth/AccountPending"));
const ForgotPassword = lazy(() => import("./components/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/Auth/ResetPassword"));
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const Error403 = lazy(() => import("./pages/Error403"));

// Shown while a page outside the dashboard (landing, auth, error pages) is
// still downloading. Dashboard pages have their own loader inside the layout.
const RouteFallback = () => <PageLoader fullScreen />;

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <SocketProvider>
            <div className="app-container">
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<LandingLayout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                  <Route path="contact" element={<Contact />} />
                </Route>

                <Route path="/login" element={<Auth />} />
                <Route path="/signup" element={<Auth />} />
                <Route path="/account-pending" element={<AccountPending />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                  path="/reset-password/:token"
                  element={<ResetPassword />}
                />

                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/forbidden" element={<Error403 />} />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardIndex />} />

                  <Route
                    path="account"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <AccountProfilePage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="sessions"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <SessionsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="tasks"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <TasksPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="submissions"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <SubmissionsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="reviews"
                    element={
                      <ProtectedRoute
                        allowedRoles={["student", "instructor", "admin"]}
                      >
                        <ReviewsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="external"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <ExternalCoursesPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="announcements"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <AnnouncementsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="users"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <UsersPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="profiles"
                    element={
                      <ProtectedRoute
                        allowedRoles={["admin", "parent", "instructor"]}
                      >
                        <StudentProfilesPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="child/:profileId"
                    element={
                      <ProtectedRoute
                        allowedRoles={["parent", "admin", "instructor"]}
                      >
                        <ChildDetailsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="progress"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <ProgressPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="progress/:profileId"
                    element={
                      <ProtectedRoute
                        allowedRoles={["parent", "admin", "instructor"]}
                      >
                        <ProgressPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="exams"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <ExamsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Canvas: instructors and admins author boards, students and
                      parents open the ones that have been shared with them.
                      Write access is enforced by the API, not by this list. */}
                  <Route
                    path="canvas"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <CanvasPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="canvas/:canvasId"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <CanvasBoardPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="messages"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <MessagesPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="messages/:userId"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <MessagesPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="channels"
                    element={
                      <ProtectedRoute
                        allowedRoles={["student", "parent", "instructor"]}
                      >
                        <ChannelsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="schedule"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <WeeklySchedulePage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="audit-logs"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <AuditLogsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="leaderboard"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <LeaderboardPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="achievements"
                    element={
                      <ProtectedRoute allowedRoles={["student"]}>
                        <AchievementsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="curriculum"
                    element={<Navigate to="/dashboard" replace />}
                  />

                  <Route
                    path="curriculum/lessons/:lessonId"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <LessonViewPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="challenges"
                    element={
                      <ProtectedRoute allowedRoles={["student"]}>
                        <ChallengesPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="challenges/manage"
                    element={
                      <ProtectedRoute allowedRoles={["instructor", "admin"]}>
                        <InstructorChallengesPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="notifications"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "parent",
                          "instructor",
                          "admin",
                        ]}
                      >
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </div>
          </SocketProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
