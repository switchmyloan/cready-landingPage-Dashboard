import './App.css'
import Home from '@pages/Home'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import PremiumPageLoader from './components/PremiumPageLoader';

// Lazy-loaded: Intelligence pulls in 13 widgets and its own Recharts surface.
// Every other import in this file is eager, so an eager import here would push
// that weight onto every user's first paint — including the majority who will
// never open the module (it is super-admin only).
const Intelligence = lazy(() => import('./pages/Intelligence/Intelligence'));
import DefaultLayout from './layouts/DefaultLayout'
import LoginPage from '@pages/Auth/LoginPage'
import ProtectedRoute from './components/ProtectedRoute';
import Leads from "@pages/LeadManagement/Leads/Leads"
import NotFound from '@pages/NotFound';
import LeadDetail from '@pages/LeadManagement/Leads/LeadDetail';
import BusinessLoanDetail from '../src/pages/LeadManagement/BusinessLoans/BusinessLoanDetail';
import BusinessLoans from './pages/LeadManagement/BusinessLoans/BusinessLoans';
import MvIVRLogs from './pages/LeadManagement/IVRLogs/MvIVRLogs';
import MvIvrLogsDetail from './pages/LeadManagement/IVRLogs/MvrIvrLogsDetail';
import CRZypeSuccessLeads from './pages/LeadManagement/Zype/CRZypeSuccessLeads';
import CRZypeDetails from "./pages/LeadManagement/Zype/CrZypeDetails"
import MVKreditBee from './pages/KreditBee/MVKreditBee';
import MVKreditBeeDetail from './pages/KreditBee/MVKreditBeeDetail';
import KBMumbai from './pages/KreditBee/KBMumbai';
import KBMumbaiDetail from './pages/KreditBee/KBMumbaiDetail';
import KBBanglore from './pages/KreditBee/KBBanglore';
import KBBangloreDetail from './pages/KreditBee/KBBangloreDetail';
import MVSuccessLeads from './pages/LeadManagement/MVSuccessLeads';
import ScResponseLeads from './pages/LeadManagement/ScResponseLeads';
import OfferLeads from './pages/LeadManagement/OfferLeads';
import OfferLeadDetail from './pages/LeadManagement/OfferLeadDetail';
import SelectedLenders from './pages/LeadManagement/SelectedLenders';
import SelectedLenderDetail from './pages/LeadManagement/SelectedLenderDetail';
import HighMisFunnel from './pages/LeadManagement/HighMisFunnel';
import KBLendingPage from './pages/LeadManagement/KBLendingPage/KBLendingPage';
import KBLendingPageDetail from './pages/LeadManagement/KBLendingPage/KBLendingPageDetail';
import DraftLeadsNew from './pages/LeadManagement/DraftLeadsNew/DraftLeadsNew';
import DraftLeadsNewDetail from './pages/LeadManagement/DraftLeadsNew/DraftLeadsNewDetail';
import OfferLeadsAnalytics from './pages/LeadManagement/OfferLeadsAnalytics';
import LendingUserJourney from './pages/LeadManagement/LendingUserJourney/LendingUserJourney';
import LendingUserJourneyDetail from './pages/LeadManagement/LendingUserJourney/LendingUserJourneyDetail';
import UserTrack from './pages/LeadManagement/UserTrack/UserTrack';
import UserTrackDetail from './pages/LeadManagement/UserTrack/UserTrackDetail';
import ShortOfferLeads from './pages/LeadManagement/Short/ShortOfferLeads';
import ShortSelectedLenders from './pages/LeadManagement/Short/ShortSelectedLenders';
import ShortSelectedLenderDetail from './pages/LeadManagement/Short/ShortSelectedLenderDetail';
import ShortDraftLeads from './pages/LeadManagement/Short/ShortDraftLeads';
import ShortOfferLeadsAnalytics from './pages/LeadManagement/Short/ShortOfferLeadsAnalytics';
import ShortUserTrack from './pages/LeadManagement/Short/ShortUserTrack';
import ShortUserTrackDetail from './pages/LeadManagement/Short/ShortUserTrackDetail';
import CreadyRpm from './pages/LeadManagement/Short/CreadyRpm';
import CreadyRpmDetail from './pages/LeadManagement/Short/CreadyRpmDetail';
import Campaign from './pages/LeadManagement/Campaign/Campaign';
import RcsCampaign from './pages/LeadManagement/Campaign/RcsCampaign';
import CampaignDetail from './pages/LeadManagement/Campaign/CampaignDetail';
import CampaignPortalDetail from './pages/LeadManagement/Campaign/CampaignPortalDetail';
import ShortKBLendingPage from './pages/LeadManagement/Short/ShortKBLendingPage';
import ShortKBLendingPageDetail from './pages/LeadManagement/Short/ShortKBLendingPageDetail';
import MVSuccessDetail from './pages/LeadManagement/MVSuccessDetail';
import OtpLogs from './pages/OtpLogs/OtpLogs';
import ExportAuditLogs from './pages/OtpLogs/ExportAuditLogs';
import MvDisbursalDashboard from './pages/LeadManagement/MvDisbursalDashboard';
import ShortDisbursalDashboard from './pages/LeadManagement/Short/ShortDisbursalDashboard';
import VyaparOfferLeads from './pages/LeadManagement/Vyapar/VyaparOfferLeads';
import VyaparSelectedLenders from './pages/LeadManagement/Vyapar/VyaparSelectedLenders';
import VyaparSelectedLenderDetail from './pages/LeadManagement/Vyapar/VyaparSelectedLenderDetail';
import VyaparDraftLeads from './pages/LeadManagement/Vyapar/VyaparDraftLeads';
import VyaparUserTrack from './pages/LeadManagement/Vyapar/VyaparUserTrack';
import VyaparUserTrackDetail from './pages/LeadManagement/Vyapar/VyaparUserTrackDetail';
import VyaparKBLendingPage from './pages/LeadManagement/Vyapar/VyaparKBLendingPage';
import VyaparKBLendingPageDetail from './pages/LeadManagement/Vyapar/VyaparKBLendingPageDetail';
import VyaparDisbursalDashboard from './pages/LeadManagement/Vyapar/VyaparDisbursalDashboard';
import CallCenterFeedback from './pages/LeadManagement/CallCenterFeedback';
import CustomerFeedback from './pages/LeadManagement/CustomerFeedback/CustomerFeedback';
import FeedbackChampions from './pages/LeadManagement/FeedbackChampions/FeedbackChampions';
import RamFinCorpFunnel from './pages/LeadManagement/RamFinCorp/RamFinCorpFunnel';
import RamFinCorpDashboard from './pages/LeadManagement/RamFinCorp/RamFinCorpDashboard';
import AllLenders from './pages/LeadManagement/AllLenders';
import VivifiWebhookLeads from './pages/LeadManagement/VivifiWebhook/VivifiWebhookLeads';
import VivifiWebhookLeadDetail from './pages/LeadManagement/VivifiWebhook/VivifiWebhookLeadDetail';
import UpSwingWebhook from './pages/LeadManagement/UpSwing/UpSwingWebhook';
import UpSwingWebhookDetail from './pages/LeadManagement/UpSwing/UpSwingWebhookDetail';
import UpSwingFunnel from './pages/LeadManagement/UpSwing/UpSwingFunnel';
import UpSwingDisbursals from './pages/LeadManagement/UpSwing/UpSwingDisbursals';
import ApolloWebhook from './pages/LeadManagement/Apollo/ApolloWebhook';
import ApolloWebhookDetail from './pages/LeadManagement/Apollo/ApolloWebhookDetail';
import ApolloFunnel from './pages/LeadManagement/Apollo/ApolloFunnel';
import ThreeNOneAnalysis from './pages/LeadManagement/ThreeNOne/ThreeNOneAnalysis';
import RouteChangeAborter from './components/RouteChangeAborter';

function App() {
  return (
    <>
      <BrowserRouter>
        <RouteChangeAborter />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
          <Route element={<DefaultLayout />}>
            <Route index element={<Home />} /> 
            <Route path="logs" element={<Leads />} />
            <Route path="business-loans" element={<BusinessLoans />} />
            <Route path="mv-ivr-logs" element={<MvIVRLogs />} />
            <Route path="lead-detail/:id" element={<LeadDetail />} />
            <Route path="business-loans/:id" element={<BusinessLoanDetail />} />
            <Route path="mv-ivr-logs/:id" element={<MvIvrLogsDetail />} />
            <Route path="cr-zype-success-leads" element={<CRZypeSuccessLeads />} />
            <Route path="cr-zype-success-leads/:id" element={<CRZypeDetails />} />
            <Route path="kb-success-leads" element={<MVKreditBee />} />
            <Route path="kb-success-leads/:id" element={<MVKreditBeeDetail />} />
            <Route path="mv-success-leads" element={<MVSuccessLeads />} />
            <Route path="mv-success-leads/:id" element={<MVSuccessDetail />} />
            <Route path="sc-response-leads" element={<ScResponseLeads />} />
            <Route path="all-lenders" element={<AllLenders />} />
            <Route
              path="intelligence"
              element={
                <Suspense fallback={<PremiumPageLoader theme="purple" title="Loading Intelligence" progressLabel="Preparing analytics" />}>
                  <Intelligence />
                </Suspense>
              }
            />
            <Route path="vivifi-webhook-leads" element={<VivifiWebhookLeads />} />
            <Route path="vivifi-webhook-leads/:leadId" element={<VivifiWebhookLeadDetail />} />
            <Route path="upswing-webhook" element={<UpSwingWebhook />} />
            <Route path="upswing-webhook/:id" element={<UpSwingWebhookDetail />} />
            <Route path="upswing-funnel" element={<UpSwingFunnel />} />
            <Route path="upswing-disbursals" element={<UpSwingDisbursals />} />
            <Route path="apollo-webhook" element={<ApolloWebhook />} />
            <Route path="apollo-webhook/:id" element={<ApolloWebhookDetail />} />
            <Route path="apollo-funnel" element={<ApolloFunnel />} />
            <Route path="3n1-page" element={<ThreeNOneAnalysis />} />
            <Route path="kb-mumbai-success-leads" element={<KBMumbai />} />
            <Route path="kb-mumbai-success-leads/:id" element={<KBMumbaiDetail />} />
            <Route path="kb-banglore-success-leads" element={<KBBanglore />} />
            <Route path="kb-banglore-success-leads/:id" element={<KBBangloreDetail />} />
            <Route path="offer-leads-analytics" element={<OfferLeadsAnalytics />} />
            <Route path="offer-leads" element={<OfferLeads />} />
            <Route path="offer-leads/:id" element={<OfferLeadDetail />} />
            <Route path="selected-lenders" element={<SelectedLenders />} />
            <Route path="selected-lenders/:id" element={<SelectedLenderDetail />} />
            <Route path="high-mis-funnel" element={<HighMisFunnel />} />
            <Route path="kb-lending-page" element={<KBLendingPage />} />
            <Route path="kb-lending-page/:id" element={<KBLendingPageDetail />} />
            <Route path="draft-leads-new" element={<DraftLeadsNew />} />
            <Route path="draft-leads-new/:id" element={<DraftLeadsNewDetail />} />
            <Route path="lending-user-journey" element={<LendingUserJourney />} />
            <Route path="lending-user-journey/:phone" element={<LendingUserJourneyDetail />} />
            <Route path="user-track" element={<UserTrack />} />
            <Route path="user-track/:phone" element={<UserTrackDetail />} />

            {/* Short Ticket CMS */}
            <Route path="short-offer-leads-analytics" element={<ShortOfferLeadsAnalytics />} />
            <Route path="short-offer-leads" element={<ShortOfferLeads />} />
            <Route path="short-offer-leads/:id" element={<OfferLeadDetail />} />
            <Route path="short-selected-lenders" element={<ShortSelectedLenders />} />
            <Route path="short-selected-lenders/:id" element={<ShortSelectedLenderDetail />} />
            <Route path="short-draft-leads" element={<ShortDraftLeads />} />
            <Route path="short-draft-leads/:id" element={<DraftLeadsNewDetail />} />
            <Route path="short-user-track" element={<ShortUserTrack />} />
            <Route path="short-user-track/:phone" element={<ShortUserTrackDetail />} />
            <Route path="cready-rpm" element={<CreadyRpm />} />
            <Route path="cready-rpm/:phone" element={<CreadyRpmDetail />} />

            {/* Campaign Team — replica of Cready RPM, gated to the campaign-team role */}
            <Route path="campaign" element={<Campaign />} />
            <Route path="rcs-campaign" element={<RcsCampaign />} />
            <Route path="campaign/portal-detail" element={<CampaignPortalDetail />} />
            <Route path="campaign/:phone" element={<CampaignDetail />} />
            <Route path="short-kb-lending-page" element={<ShortKBLendingPage />} />
            <Route path="short-kb-lending-page/:id" element={<ShortKBLendingPageDetail />} />

            {/* Vyapar CMS — parallel module to Short Ticket */}
            <Route path="vyapar-offer-leads" element={<VyaparOfferLeads />} />
            <Route path="vyapar-offer-leads/:id" element={<OfferLeadDetail />} />
            <Route path="vyapar-selected-lenders" element={<VyaparSelectedLenders />} />
            <Route path="vyapar-selected-lenders/:id" element={<VyaparSelectedLenderDetail />} />
            <Route path="vyapar-draft-leads" element={<VyaparDraftLeads />} />
            <Route path="vyapar-draft-leads/:id" element={<DraftLeadsNewDetail />} />
            <Route path="vyapar-user-track" element={<VyaparUserTrack />} />
            <Route path="vyapar-user-track/:phone" element={<VyaparUserTrackDetail />} />
            <Route path="vyapar-kb-lending-page" element={<VyaparKBLendingPage />} />
            <Route path="vyapar-kb-lending-page/:id" element={<VyaparKBLendingPageDetail />} />

            {/* Disbursal Dashboards — scoped per role */}
            <Route path="disbursal-dashboard" element={<MvDisbursalDashboard />} />
            <Route path="short-disbursal-dashboard" element={<ShortDisbursalDashboard />} />
            <Route path="vyapar-disbursal-dashboard" element={<VyaparDisbursalDashboard />} />

            {/* Call-center feedback — funnel + agent activity + records in one module */}
            <Route path="call-center-feedback" element={<CallCenterFeedback />} />

            {/* Customer feedback (testimonials / CSAT) — read-only list + detail */}
            <Route path="customer-feedback" element={<CustomerFeedback />} />

            {/* Feedback Champions — call-centre leaderboard (who brings in feedback) */}
            <Route path="feedback-champions" element={<FeedbackChampions />} />

            {/* RamFinCorp funnel — MIS-based journey funnel + stage drill */}
            <Route path="ramfincorp-funnel" element={<RamFinCorpFunnel />} />

            {/* RF Dashboard — the daily dedupe→offer report in RamFinCorp's own format */}
            <Route path="ramfincorp-dashboard" element={<RamFinCorpDashboard />} />

            {/* Super-admin only */}
            <Route path="otp-logs" element={<OtpLogs />} />
            <Route path="export-audit-logs" element={<ExportAuditLogs />} />

          <Route path="*" element={<NotFound />} />
          </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App