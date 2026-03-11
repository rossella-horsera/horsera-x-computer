import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import RidePage from "./pages/RidePage";
import LearnPage from "./pages/LearnPage";
import ProgressPage from "./pages/ProgressPage";
import GeniePage from "./pages/GeniePage";
import EvidenceStudioPage from "./pages/EvidenceStudioPage";
import PositionStabilityPage from "./pages/PositionStabilityPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/ride" element={<RidePage />} />
            <Route path="/ride/:rideId/evidence" element={<EvidenceStudioPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/progress/position-stability" element={<PositionStabilityPage />} />
            <Route path="/genie" element={<GeniePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
