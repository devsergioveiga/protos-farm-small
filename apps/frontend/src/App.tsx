import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/stores/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminRoute from '@/components/auth/AdminRoute';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AcceptInvitePage = lazy(() => import('@/pages/AcceptInvitePage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const RolesPage = lazy(() => import('@/pages/RolesPage'));
const OrgUsersPage = lazy(() => import('@/pages/OrgUsersPage'));
const FarmsPage = lazy(() => import('@/pages/FarmsPage'));
const FarmMapPage = lazy(() => import('@/pages/FarmMapPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminOrganizationsPage = lazy(() => import('@/pages/AdminOrganizationsPage'));
const AdminAuditLogsPage = lazy(() => import('@/pages/AdminAuditLogsPage'));
const ProducersPage = lazy(() => import('@/pages/ProducersPage'));
const AnimalsPage = lazy(() => import('@/pages/AnimalsPage'));
const LotsPage = lazy(() => import('@/pages/LotsPage'));
const WeighingSessionPage = lazy(() => import('@/pages/WeighingSessionPage'));
const AnimalDetailPage = lazy(() => import('@/pages/AnimalDetailPage'));
const CultivarsPage = lazy(() => import('@/pages/CultivarsPage'));
const PesticideApplicationsPage = lazy(() => import('@/pages/PesticideApplicationsPage'));
const PesticidePrescriptionsPage = lazy(() => import('@/pages/PesticidePrescriptionsPage'));
const FertilizerApplicationsPage = lazy(() => import('@/pages/FertilizerApplicationsPage'));
const CulturalOperationsPage = lazy(() => import('@/pages/CulturalOperationsPage'));
const FieldTeamsPage = lazy(() => import('@/pages/FieldTeamsPage'));
const TeamOperationsPage = lazy(() => import('@/pages/TeamOperationsPage'));
const PestsPage = lazy(() => import('@/pages/PestsPage'));
const MonitoringPointsPage = lazy(() => import('@/pages/MonitoringPointsPage'));
const MonitoringRecordsPage = lazy(() => import('@/pages/MonitoringRecordsPage'));
const MonitoringHeatmapPage = lazy(() => import('@/pages/MonitoringHeatmapPage'));
const MonitoringTimelinePage = lazy(() => import('@/pages/MonitoringTimelinePage'));
const MonitoringRecommendationsPage = lazy(() => import('@/pages/MonitoringRecommendationsPage'));
const MonitoringReportPage = lazy(() => import('@/pages/MonitoringReportPage'));
const OperationTypesPage = lazy(() => import('@/pages/OperationTypesPage'));
const PlantingPage = lazy(() => import('@/pages/PlantingPage'));
const SoilPrepPage = lazy(() => import('@/pages/SoilPrepPage'));
const CoffeeHarvestsPage = lazy(() => import('@/pages/CoffeeHarvestsPage'));
const OrangeHarvestsPage = lazy(() => import('@/pages/OrangeHarvestsPage'));
const MeasurementUnitsPage = lazy(() => import('@/pages/MeasurementUnitsPage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const StockEntriesPage = lazy(() => import('@/pages/StockEntriesPage'));
const StockOutputsPage = lazy(() => import('@/pages/StockOutputsPage'));
const StockAlertsPage = lazy(() => import('@/pages/StockAlertsPage'));
const StockInventoriesPage = lazy(() => import('@/pages/StockInventoriesPage'));
const ConversionHistoryPage = lazy(() => import('@/pages/ConversionHistoryPage'));
const GrainDiscountsPage = lazy(() => import('@/pages/GrainDiscountsPage'));
const DiseasesPage = lazy(() => import('@/pages/DiseasesPage'));
const TreatmentProtocolsPage = lazy(() => import('@/pages/TreatmentProtocolsPage'));
const SanitaryProtocolsPage = lazy(() => import('@/pages/SanitaryProtocolsPage'));
const VaccinationsPage = lazy(() => import('@/pages/VaccinationsPage'));
const DewormingsPage = lazy(() => import('@/pages/DewormingsPage'));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/users" element={<OrgUsersPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/farms" element={<FarmsPage />} />
                <Route path="/farms/:farmId/map" element={<FarmMapPage />} />
                <Route path="/producers" element={<ProducersPage />} />
                <Route path="/animals" element={<AnimalsPage />} />
                <Route path="/animals/:animalId" element={<AnimalDetailPage />} />
                <Route path="/lots" element={<LotsPage />} />
                <Route path="/weighing-session" element={<WeighingSessionPage />} />
                <Route path="/cultivars" element={<CultivarsPage />} />
                <Route path="/pesticide-applications" element={<PesticideApplicationsPage />} />
                <Route path="/pesticide-prescriptions" element={<PesticidePrescriptionsPage />} />
                <Route path="/fertilizer-applications" element={<FertilizerApplicationsPage />} />
                <Route path="/cultural-operations" element={<CulturalOperationsPage />} />
                <Route path="/field-teams" element={<FieldTeamsPage />} />
                <Route path="/team-operations" element={<TeamOperationsPage />} />
                <Route path="/operation-types" element={<OperationTypesPage />} />
                <Route path="/planting" element={<PlantingPage />} />
                <Route path="/soil-prep" element={<SoilPrepPage />} />
                <Route path="/coffee-harvests" element={<CoffeeHarvestsPage />} />
                <Route path="/orange-harvests" element={<OrangeHarvestsPage />} />
                <Route path="/pests" element={<PestsPage />} />
                <Route path="/measurement-units" element={<MeasurementUnitsPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/stock-entries" element={<StockEntriesPage />} />
                <Route path="/stock-outputs" element={<StockOutputsPage />} />
                <Route path="/stock-alerts" element={<StockAlertsPage />} />
                <Route path="/stock-inventories" element={<StockInventoriesPage />} />
                <Route path="/conversion-history" element={<ConversionHistoryPage />} />
                <Route path="/grain-discounts" element={<GrainDiscountsPage />} />
                <Route path="/diseases" element={<DiseasesPage />} />
                <Route path="/treatment-protocols" element={<TreatmentProtocolsPage />} />
                <Route path="/sanitary-protocols" element={<SanitaryProtocolsPage />} />
                <Route path="/vaccinations" element={<VaccinationsPage />} />
                <Route path="/dewormings" element={<DewormingsPage />} />
                <Route
                  path="/farms/:farmId/plots/:fieldPlotId/monitoring-points"
                  element={<MonitoringPointsPage />}
                />
                <Route
                  path="/farms/:farmId/plots/:fieldPlotId/monitoring-records"
                  element={<MonitoringRecordsPage />}
                />
                <Route
                  path="/farms/:farmId/plots/:fieldPlotId/monitoring-heatmap"
                  element={<MonitoringHeatmapPage />}
                />
                <Route
                  path="/farms/:farmId/plots/:fieldPlotId/monitoring-timeline"
                  element={<MonitoringTimelinePage />}
                />
                <Route
                  path="/farms/:farmId/plots/:fieldPlotId/monitoring-recommendations"
                  element={<MonitoringRecommendationsPage />}
                />
                <Route path="/farms/:farmId/monitoring-report" element={<MonitoringReportPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
