import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Breadcrumb from "../components/BreadCrumb/BreadCrumb";
import BackToTop from "../components/BackToTop";
import { Outlet, useLocation } from "react-router-dom";
import { cancelPendingRequests } from "../api-services/api";

function DefaultLayout({ children }) {
  // Abort every in-flight request when the user leaves a module.
  //
  // The axios layer already attaches an AbortController to each request and
  // exports cancelPendingRequests() — but NOTHING was calling it, so a heavy page
  // the user navigated away from kept its request alive: the browser held the
  // socket open and the backend kept the query running for an answer nobody was
  // going to read. Clicking through four modules queued four full workloads.
  //
  // Fires on pathname change only. Skipping the first render matters: aborting
  // there would kill the requests the landing page just started.
  const { pathname } = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    cancelPendingRequests(`route-change:${pathname}`);
  }, [pathname]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

    const toggleSidebarCollapse = () =>
    setIsSidebarCollapsed(!isSidebarCollapsed);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar: Hidden on mobile, visible on larger screens */}
      {/* <div
        className={`fixed inset-y-0 left-0 w-64 transform bg-gray-800 text-white z-50 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:fixed md:w-64`}
      > */}
       <div
        className={`fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? "w-20" : "w-64"}
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:fixed`}
      >
        <Sidebar 
        onClose={toggleSidebar} 
        collapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Main content area */}
      {/* <div className="flex-1 flex flex-col sx:ml-64 md:ml-64"> */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        {/* Navbar */}
        {/* <div className="fixed top-0 left-0 right-0 z-30 md:left-64 md:w-[calc(100%-16rem)]"> */}
        <div className="fixed top-0 left-0 right-0 z-30 md:left-auto md:w-full md:pl-0">
          <Navbar 
          onToggleSidebar={toggleSidebar} 
          onToggleCollapse={toggleSidebarCollapse}
          />
        </div>

         {/* Fixed Breadcrumb */}
        {/* <div className="fixed top-12 left-0 right-0 z-20 md:left-64 md:w-[calc(100%-16rem)]">
          <Breadcrumb />
        </div> */}
        <div
          className={`fixed top-12 left-0 right-0 z-20 transition-all duration-300 ${
            isSidebarCollapsed ? "md:pl-20" : "md:pl-64"
          }`}
        >
          <Breadcrumb />
        </div>
        <main className="flex-1 p-4 mt-24 overflow-y-auto overflow-x-hidden min-w-0">
          {/* {children} */}
          <Outlet />
        </main>
      </div>

      {/* Floating scroll-to-top — global, shows on every page once scrolled */}
      <BackToTop />
    </div>
  );
}

export default DefaultLayout;
