import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AssuranceSante from "./pages/assurances/AssuranceSante";
import Assurance3ePilier from "./pages/assurances/Assurance3ePilier";
import AssuranceRCMenage from "./pages/assurances/AssuranceRCMenage";
import AssuranceAuto from "./pages/assurances/AssuranceAuto";
import ProtectionJuridique from "./pages/assurances/ProtectionJuridique";
import Hypotheque from "./pages/assurances/Hypotheque";
import AssurancePersonnel from "./pages/entreprises/AssurancePersonnel";
import PrevoyanceLPP from "./pages/entreprises/PrevoyanceLPP";
import APropos from "./pages/APropos";
import Carriere from "./pages/Carriere";
import Connexion from "./pages/Connexion";
import Simulateurs from "./pages/Simulateurs";
import Assurances from "./pages/Assurances";
import MentionsLegales from "./pages/MentionsLegales";
import PolitiqueConfidentialite from "./pages/PolitiqueConfidentialite";
import { ProtectedRoute } from "./components/ProtectedRoute";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Assurances Hub */}
          <Route path="/assurances" element={<Assurances />} />
          
          {/* Assurances Particuliers */}
          <Route path="/assurances/sante" element={<AssuranceSante />} />
          <Route path="/assurances/3e-pilier" element={<Assurance3ePilier />} />
          <Route path="/assurances/rc-menage" element={<AssuranceRCMenage />} />
          <Route path="/assurances/auto" element={<AssuranceAuto />} />
          <Route path="/assurances/protection-juridique" element={<ProtectionJuridique />} />
          <Route path="/assurances/hypotheque" element={<Hypotheque />} />
          
          {/* Entreprises */}
          <Route path="/entreprises/personnel" element={<AssurancePersonnel />} />
          <Route path="/entreprises/lpp" element={<PrevoyanceLPP />} />
          
          {/* Other Pages */}
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/carriere" element={<Carriere />} />
          <Route path="/simulateurs" element={<Simulateurs />} />
          <Route path="/connexion" element={<Connexion />} />
          
          {/* Legal Pages */}
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
          
          {/* CRM Routes */}
          <Route path="/crm" element={<ProtectedRoute><CRMLayout /></ProtectedRoute>}>
            <Route index element={<CRMDashboard />} />
            <Route path="clients" element={<CRMClients />} />
            <Route path="clients/nouveau" element={<ClientForm />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="clients/:id/modifier" element={<ClientForm />} />
            <Route path="suivis" element={<CRMSuivis />} />
            <Route path="propositions" element={<CRMPropositions />} />
            <Route path="contrats" element={<CRMContracts />} />
            <Route path="commissions" element={<CRMCommissions />} />
            <Route path="collaborateurs" element={<CRMCollaborateurs />} />
            <Route path="rapports" element={<CRMRapports />} />
            <Route path="parametres" element={<CRMParametres />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
