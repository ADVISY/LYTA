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
import CRMClients from "./pages/crm/CRMClients";
import CRMContracts from "./pages/crm/CRMContracts";

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
            <Route path="contracts" element={<CRMContracts />} />
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
