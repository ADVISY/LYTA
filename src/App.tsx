import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { TenantProvider } from "./contexts/TenantContext";
import { ThemeProvider } from "./hooks/useTheme";
import { CelebrationProvider } from "./hooks/useCelebration";
import Connexion from "./pages/Connexion";
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DeposerContrat = lazy(() => import("./pages/DeposerContrat"));
const Signer = lazy(() => import("./pages/Signer"));
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { TenantGate } from "./components/TenantGate";
import { SessionEnforcer } from "./components/SessionEnforcer";

// CRM (lazy loaded)
const CRMLayout = lazy(() => import("./pages/crm/CRMLayout"));
const CRMDashboard = lazy(() => import("./pages/crm/CRMDashboard"));
const CRMClients = lazy(() => import("./pages/crm/clients/ClientsList"));
const ClientForm = lazy(() => import("./pages/crm/clients/ClientForm"));
const ClientDetail = lazy(() => import("./pages/crm/clients/ClientDetail"));
const CRMSuivis = lazy(() => import("./pages/crm/CRMSuivis"));
const CRMPropositions = lazy(() => import("./pages/crm/CRMPropositions"));
const CRMContracts = lazy(() => import("./pages/crm/CRMContracts"));
const CRMCommissions = lazy(() => import("./pages/crm/CRMCommissions"));
const CRMCollaborateurs = lazy(() => import("./pages/crm/CRMCollaborateurs"));
const CRMRapports = lazy(() => import("./pages/crm/CRMRapports"));
const CRMParametres = lazy(() => import("./pages/crm/CRMParametres"));
const CRMCompagnies = lazy(() => import("./pages/crm/CRMCompagnies"));
const CRMCompta = lazy(() => import("./pages/crm/CRMCompta"));
const CRMPublicite = lazy(() => import("./pages/crm/CRMPublicite"));
const CRMAbonnement = lazy(() => import("./pages/crm/CRMAbonnement"));
const CRMLytaTools = lazy(() => import("./pages/crm/CRMLytaTools"));
const CRMSignatures = lazy(() => import("./pages/crm/CRMSignatures"));

// Client Portal (lazy loaded)
const ClientLayout = lazy(() => import("./pages/client/ClientLayout"));
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const ClientContracts = lazy(() => import("./pages/client/ClientContracts"));
const ClientDocuments = lazy(() => import("./pages/client/ClientDocuments"));
const ClientMessages = lazy(() => import("./pages/client/ClientMessages"));
const ClientNotifications = lazy(() => import("./pages/client/ClientNotifications"));
const ClientReferrals = lazy(() => import("./pages/client/ClientReferrals"));
const ClientProfile = lazy(() => import("./pages/client/ClientProfile"));
const ClientClaims = lazy(() => import("./pages/client/ClientClaims"));

// KING Platform (lazy loaded)
const KingLayout = lazy(() => import("./pages/king/KingLayout"));
const KingDashboard = lazy(() => import("./pages/king/KingDashboard"));
const KingTenants = lazy(() => import("./pages/king/KingTenants"));
const KingTenantDetail = lazy(() => import("./pages/king/KingTenantDetail"));
const KingWizard = lazy(() => import("./pages/king/KingWizard"));
const KingUsers = lazy(() => import("./pages/king/KingUsers"));
const KingSecurity = lazy(() => import("./pages/king/KingSecurity"));
const KingSettings = lazy(() => import("./pages/king/KingSettings"));
const KingPlans = lazy(() => import("./pages/king/KingPlans"));
const ComplianceReport = lazy(() => import("./pages/king/ComplianceReport"));
const TenantOnboarding = lazy(() => import("./pages/king/TenantOnboarding"));
const KingTenantImport = lazy(() => import("./pages/king/KingTenantImport"));
const KingAffiliates = lazy(() => import("./pages/king/KingAffiliates"));
const KingAffiliateDetail = lazy(() => import("./pages/king/KingAffiliateDetail"));
const KingCatalog = lazy(() => import("./pages/king/KingCatalog"));
const KingAppsManager = lazy(() => import("./pages/king/KingAppsManager"));
const FontPreview = lazy(() => import("./pages/FontPreview"));

// Add spinner animation for Suspense fallback
if (typeof document !== 'undefined' && !document.getElementById('suspense-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'suspense-spinner-style';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <CelebrationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <SessionEnforcer />
              <TenantProvider>
                <TenantGate>
                  <ErrorBoundary>
                  <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><div style={{ width: "2rem", height: "2rem", border: "3px solid #e5e7eb", borderTopColor: "#1800AD", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /></div>}>
                  <Routes>
              {/* Redirect root to login */}
              <Route path="/" element={<Navigate to="/connexion" replace />} />
              
              {/* Login Page */}
              <Route path="/connexion" element={<Connexion />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/deposer-contrat" element={<DeposerContrat />} />
              <Route path="/signer/:token" element={<Signer />} />
              <Route path="/font-preview" element={<FontPreview />} />
              
              {/* CRM Routes */}
              <Route path="/crm" element={<ProtectedRoute><ErrorBoundary space="CRM"><CRMLayout /></ErrorBoundary></ProtectedRoute>}>
                <Route index element={<CRMDashboard />} />
                <Route path="clients" element={<CRMClients />} />
                <Route path="clients/nouveau" element={<ClientForm />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="clients/:id/edit" element={<ClientForm />} />
                <Route path="suivis" element={<CRMSuivis />} />
                <Route path="propositions" element={<CRMPropositions />} />
                <Route path="contrats" element={<CRMContracts />} />
                <Route path="commissions" element={<CRMCommissions />} />
                <Route path="collaborateurs" element={<CRMCollaborateurs />} />
                <Route path="rapports" element={<CRMRapports />} />
                <Route path="parametres" element={<CRMParametres />} />
                <Route path="compagnies" element={<CRMCompagnies />} />
                <Route path="compta" element={<CRMCompta />} />
                <Route path="publicite" element={<CRMPublicite />} />
                <Route path="abonnement" element={<CRMAbonnement />} />
                <Route path="tools" element={<CRMLytaTools />} />
                <Route path="signatures" element={<CRMSignatures />} />
              </Route>
              
              {/* KING Platform Routes */}
              <Route path="/king" element={<ProtectedRoute><ErrorBoundary space="King"><KingLayout /></ErrorBoundary></ProtectedRoute>}>
                <Route index element={<KingDashboard />} />
                <Route path="tenants" element={<KingTenants />} />
                <Route path="tenants/:tenantId" element={<KingTenantDetail />} />
                <Route path="tenants/:tenantId/import" element={<KingTenantImport />} />
                <Route path="wizard" element={<KingWizard />} />
                <Route path="affiliates" element={<KingAffiliates />} />
                <Route path="affiliates/:id" element={<KingAffiliateDetail />} />
                <Route path="catalog" element={<KingCatalog />} />
                <Route path="apps" element={<KingAppsManager />} />
                <Route path="users" element={<KingUsers />} />
                <Route path="plans" element={<KingPlans />} />
                <Route path="security" element={<KingSecurity />} />
                <Route path="settings" element={<KingSettings />} />
                <Route path="compliance" element={<ComplianceReport />} />
                <Route path="onboarding" element={<TenantOnboarding />} />
              </Route>
              
              {/* Client Portal Routes */}
              <Route path="/espace-client" element={<ProtectedRoute><ErrorBoundary space="Client"><ClientLayout /></ErrorBoundary></ProtectedRoute>}>
                <Route index element={<ClientDashboard />} />
                <Route path="contrats" element={<ClientContracts />} />
                <Route path="documents" element={<ClientDocuments />} />
                <Route path="sinistres" element={<ClientClaims />} />
                <Route path="messages" element={<ClientMessages />} />
                <Route path="notifications" element={<ClientNotifications />} />
                <Route path="recommandations" element={<ClientReferrals />} />
                <Route path="profil" element={<ClientProfile />} />
              </Route>
              
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
                  </Suspense>
                  </ErrorBoundary>
                </TenantGate>
              </TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </CelebrationProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
