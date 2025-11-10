import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
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
          <Route path="/connexion" element={<Connexion />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
