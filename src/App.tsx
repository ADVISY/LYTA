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
import ResetPassword from "./pages/ResetPassword";
import DeposerContrat from "./pages/DeposerContrat";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

// CRM
import CRMLayout from "./pages/crm/CRMLayout";
import CRMDashboard from "./pages/crm/CRMDashboard";
import CRMClients from "./pages/crm/clients/ClientsList";
import ClientForm from "./pages/crm/clients/ClientForm";
import ClientDetail from "./pages/crm/clients/ClientDetail";
import CRMSuivis from "./pages/crm/CRMSuivis";
import CRMPropositions from "./pages/crm/CRMPropositions";
import CRMContracts from "./pages/crm/CRMContracts";
import CRMCommissions from "./pages/crm/CRMCommissions";
import CRMCollaborateurs from "./pages/crm/CRMCollaborateurs";
import CRMRapports from "./pages/crm/CRMRapports";
import CRMParametres from "./pages/crm/CRMParametres";
import CRMCompagnies from "./pages/crm/CRMCompagnies";
import CRMCompta from "./pages/crm/CRMCompta";
import CRMPublicite from "./pages/crm/CRMPublicite";
import CRMAbonnement from "./pages/crm/CRMAbonnement";

// Client Portal
import ClientLayout from "./pages/client/ClientLayout";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientContracts from "./pages/client/ClientContracts";
import ClientDocuments from "./pages/client/ClientDocuments";
import ClientMessages from "./pages/client/ClientMessages";
import ClientNotifications from "./pages/client/ClientNotifications";
import ClientProfile from "./pages/client/ClientProfile";
import ClientClaims from "./pages/client/ClientClaims";

// KING Platform
import KingLayout from "./pages/king/KingLayout";
import KingDashboard from "./pages/king/KingDashboard";
import KingTenants from "./pages/king/KingTenants";
import KingTenantDetail from "./pages/king/KingTenantDetail";
import KingWizard from "./pages/king/KingWizard";
import KingUsers from "./pages/king/KingUsers";
import KingSecurity from "./pages/king/KingSecurity";
import KingSettings from "./pages/king/KingSettings";

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
              <TenantProvider>
                <Routes>
              {/* Redirect root to login */}
              <Route path="/" element={<Navigate to="/connexion" replace />} />
              
              {/* Login Page */}
              <Route path="/connexion" element={<Connexion />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/deposer-contrat" element={<DeposerContrat />} />
              
              {/* CRM Routes */}
              <Route path="/crm" element={<ProtectedRoute><CRMLayout /></ProtectedRoute>}>
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
              </Route>
              
              {/* KING Platform Routes */}
              <Route path="/king" element={<ProtectedRoute><KingLayout /></ProtectedRoute>}>
                <Route index element={<KingDashboard />} />
                <Route path="tenants" element={<KingTenants />} />
                <Route path="tenants/:tenantId" element={<KingTenantDetail />} />
                <Route path="wizard" element={<KingWizard />} />
                <Route path="users" element={<KingUsers />} />
                <Route path="security" element={<KingSecurity />} />
                <Route path="settings" element={<KingSettings />} />
              </Route>
              
              {/* Client Portal Routes */}
              <Route path="/espace-client" element={<ClientLayout />}>
                <Route index element={<ClientDashboard />} />
                <Route path="contrats" element={<ClientContracts />} />
                <Route path="documents" element={<ClientDocuments />} />
                <Route path="sinistres" element={<ClientClaims />} />
                <Route path="messages" element={<ClientMessages />} />
                <Route path="notifications" element={<ClientNotifications />} />
                <Route path="profil" element={<ClientProfile />} />
              </Route>
              
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </CelebrationProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
