import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import Register from "./components/Register";
import ProfileSection from "./components/ProfileSection";
import ForgotPassword from "./components/ForgotPassword";
import ResetPasswordConfirm from "./components/ResetPasswordConfirm";
import Sidebar from "./components/Sidebar";
import Accounts from "./pages/Accounts";
import Technicians from "./pages/Technicians";
import Customer from "./pages/Customer";
import Inventory from "./pages/Inventory";
import Lead from "./pages/Lead";
import Quotation from "./pages/Quotation";
import Project from "./pages/Project";
import AMC from "./pages/AMC";
import AMCServices from "./pages/AMCServices";
import TechnicianDashboard from "./pages/technician/TechnicianDashboard";
import WorkDesk from "./pages/technician/WorkDesk";
import FieldMap from "./pages/technician/FieldMap";
import CustomerProjects from "./components/customer_login/CustomerProjects";
import CustomerAMCs from "./components/customer_login/CustomerAMCs";
import CustomerServices from "./components/customer_login/CustomerServices";
import CustomerTickets from "./components/customer_login/CustomerTickets";
import Tickets from "./pages/Tickets";

import ProductList from './components/products/ProductList';
import ProductForm from './components/products/ProductForm';
import CategoryList from './components/products/CategoryList';
import FollowUp from "./components/lead/FollowUp";
import TermsCategoriesList from "./components/terms_conditions/TermsCategoriesList";
import TermsCategoryForm from "./components/terms_conditions/TermsCategoryForm";
import TermsForm from "./components/terms_conditions/TermsForm";

import RolesPage from "./pages/RolesPage";
import NotificationsPage from "./pages/NotificationsPage";
import TemplatesPage from "./pages/TemplatesPage";
import TallyIntegrationPage from "./pages/TallyIntegrationPage";
import BillingDetailsList from "./components/billing/BillingDetailsList";
import BillingDetailsForm from "./components/billing/BillingDetailsForm";
import InvoiceManagement from "./pages/InvoiceManagement";
import InvoiceFormView from "./components/invoice/InvoiceFormView";
import { useUserRole } from "./hooks/useAuth";
import { useTechnicianLocationTracker } from "./hooks/useTechnicianLocationTracker";
import { getBaseApiUrl } from "./utils/apiConfig";
import { getValidAccessToken, isUserLoggedIn } from "./utils/authUtils";

function ProtectedRoute({ children }) {
  const token = getValidAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function ModuleProtectedRoute({ module, action = "view", children }) {
  const token = getValidAccessToken();
  const baseApi = getBaseApiUrl();
  const { userRole, userInfo, isLoading, hasPermission } = useUserRole(baseApi);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading && !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500 font-sans text-sm">
        Verifying permissions...
      </div>
    );
  }

  const roleName = (userRole?.name || userInfo?.role_name || userInfo?.role?.name || "").toLowerCase();
  const isCustomer = roleName === "customer" || Boolean(userInfo?.is_customer) || userInfo?.user_type === "customer";

  if (isCustomer) {
    return <Navigate to="/dashboard" replace />;
  }

  const isTechnician = roleName === "technician" || roleName.includes("technician") || Boolean(userInfo?.is_technician);

  if (isTechnician) {
    if (module === "projects") {
      return children;
    }
    return <Navigate to="/technician/work-desk" replace />;
  }

  if (!hasPermission(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function CustomerProtectedRoute({ children }) {
  const token = getValidAccessToken();
  const baseApi = getBaseApiUrl();
  const { userRole, userInfo, isLoading } = useUserRole(baseApi);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading && !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500 font-sans text-sm">
        Loading your portal...
      </div>
    );
  }

  const roleName = (userRole?.name || userInfo?.role_name || userInfo?.role?.name || "").toLowerCase();
  const isCustomer = roleName === "customer" || Boolean(userInfo?.is_customer) || userInfo?.user_type === "customer";

  if (!isCustomer) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const location = useLocation();
  const [, setAuthTick] = useState(0);

  // Background GPS tracker runs automatically when a technician logs in / has tab open
  useTechnicianLocationTracker();

  useEffect(() => {
    const handleAuthChange = () => setAuthTick((t) => t + 1);
    window.addEventListener("authChange", handleAuthChange);
    return () => window.removeEventListener("authChange", handleAuthChange);
  }, []);

  const noNavPaths = ["/login", "/customer/login", "/register", "/forgot-password"];
  const isLoggedIn = isUserLoggedIn();

  const hideLayout =
    !isLoggedIn ||
    noNavPaths.includes(location.pathname) ||
    location.pathname.startsWith("/password-reset-confirm/");

  const renderRoutes = () => (
    <Routes>
      <Route
        path="/"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={<Login />}
      />
      <Route
        path="/customer/login"
        element={<Login />}
      />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileSection />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      {/* Dedicated Technician Field Routes - Single Unified Work Desk */}
      <Route
        path="/technician/dashboard"
        element={
          <ProtectedRoute>
            <TechnicianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/work-desk"
        element={
          <ProtectedRoute>
            <WorkDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/field-map"
        element={
          <ProtectedRoute>
            <FieldMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technicians/map"
        element={<Navigate to="/technician/field-map" replace />}
      />
      <Route
        path="/technician/todays-work"
        element={<Navigate to="/technician/work-desk?filter=today" replace />}
      />
      <Route
        path="/technician/completed-work"
        element={<Navigate to="/technician/work-desk?filter=completed" replace />}
      />

      {/* Dedicated Customer Portal Read-Only Routes */}
      <Route
        path="/customer-portal/projects"
        element={
          <CustomerProtectedRoute>
            <CustomerProjects />
          </CustomerProtectedRoute>
        }
      />
      <Route
        path="/customer-portal/amcs"
        element={
          <CustomerProtectedRoute>
            <CustomerAMCs />
          </CustomerProtectedRoute>
        }
      />
      <Route
        path="/customer-portal/services"
        element={
          <CustomerProtectedRoute>
            <CustomerServices />
          </CustomerProtectedRoute>
        }
      />
      <Route
        path="/customer-portal/tickets"
        element={
          <CustomerProtectedRoute>
            <CustomerTickets />
          </CustomerProtectedRoute>
        }
      />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/password-reset-confirm/:uid/:token" element={<ResetPasswordConfirm />} />

      {/* Dynamic Role-Protected Routes */}
      <Route
        path="/accounts"
        element={
          <ModuleProtectedRoute module="accounts">
            <Accounts />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/technicians"
        element={
          <ProtectedRoute>
            <Technicians />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ModuleProtectedRoute module="roles">
            <RolesPage />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/customer"
        element={
          <ModuleProtectedRoute module="customers">
            <Customer />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ModuleProtectedRoute module="inventory">
            <Inventory />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <ModuleProtectedRoute module="tickets">
            <Tickets />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ModuleProtectedRoute module="projects">
            <Project />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/amc"
        element={
          <ModuleProtectedRoute module="amc">
            <AMC />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/amc-services"
        element={
          <ModuleProtectedRoute module="amc">
            <AMCServices />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={<Navigate to="/amc-services" replace />}
      />
      <Route
        path="/leads"
        element={
          <ModuleProtectedRoute module="leads">
            <Lead />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/quotations"
        element={
          <ModuleProtectedRoute module="quotations">
            <Quotation />
          </ModuleProtectedRoute>
        }
      />
      <Route path="/quotation" element={<Navigate to="/quotations" replace />} />

      {/* Invoice & Billing Routes */}
      <Route
        path="/invoices"
        element={
          <ModuleProtectedRoute module="invoices">
            <InvoiceManagement />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/invoices/create"
        element={
          <ModuleProtectedRoute module="invoices" action="create">
            <InvoiceFormView />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/invoices/:id/edit"
        element={
          <ModuleProtectedRoute module="invoices" action="edit">
            <InvoiceFormView />
          </ModuleProtectedRoute>
        }
      />
      <Route path="/invoice" element={<Navigate to="/invoices" replace />} />

      {/* Product Routes */}
      <Route
        path="/products"
        element={
          <ModuleProtectedRoute module="products">
            <ProductList />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/products/add"
        element={
          <ModuleProtectedRoute module="products" action="create">
            <ProductForm />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/products/edit/:id"
        element={
          <ModuleProtectedRoute module="products" action="edit">
            <ProductForm />
          </ModuleProtectedRoute>
        }
      />

      {/* Category Routes */}
      <Route
        path="/categories"
        element={
          <ModuleProtectedRoute module="products">
            <CategoryList />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/categories/add"
        element={
          <ModuleProtectedRoute module="products" action="create">
            <CategoryList />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/categories/edit/:id"
        element={
          <ModuleProtectedRoute module="products" action="edit">
            <CategoryList />
          </ModuleProtectedRoute>
        }
      />

      {/* Follow-up Routes */}
      <Route
        path="/follow-up"
        element={
          <ModuleProtectedRoute module="followups">
            <FollowUp />
          </ModuleProtectedRoute>
        }
      />

      {/* Terms Routes */}
      <Route
        path="/terms"
        element={
          <ModuleProtectedRoute module="terms">
            <TermsCategoriesList />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/terms/add-category"
        element={
          <ModuleProtectedRoute module="terms" action="create">
            <TermsCategoryForm />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/terms/edit-category/:id"
        element={
          <ModuleProtectedRoute module="terms" action="edit">
            <TermsCategoryForm />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/terms/add-term"
        element={
          <ModuleProtectedRoute module="terms" action="create">
            <TermsForm />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/terms/edit-term/:id"
        element={
          <ModuleProtectedRoute module="terms" action="edit">
            <TermsForm />
          </ModuleProtectedRoute>
        }
      />

      {/* Message Templates Routes */}
      <Route
        path="/message-templates"
        element={
          <ModuleProtectedRoute module="templates">
            <TemplatesPage />
          </ModuleProtectedRoute>
        }
      />
      <Route path="/templates" element={<Navigate to="/message-templates" replace />} />

      {/* Tally Integration Route */}
      <Route
        path="/tally-integration"
        element={
          <ModuleProtectedRoute module="tally">
            <TallyIntegrationPage />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/tally"
        element={<Navigate to="/tally-integration" replace />}
      />

      {/* Billing Details Master Routes */}
      <Route
        path="/billing-details"
        element={
          <ModuleProtectedRoute module="billing">
            <BillingDetailsList />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/billing-details/add"
        element={
          <ModuleProtectedRoute module="billing" action="create">
            <BillingDetailsForm />
          </ModuleProtectedRoute>
        }
      />
      <Route
        path="/billing-details/edit/:id"
        element={
          <ModuleProtectedRoute module="billing" action="edit">
            <BillingDetailsForm />
          </ModuleProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  if (hideLayout) {
    return (
      <div className="min-h-screen w-full font-sans antialiased">
        {renderRoutes()}
      </div>
    );
  }

  return (
    <Sidebar>
      {renderRoutes()}
    </Sidebar>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}