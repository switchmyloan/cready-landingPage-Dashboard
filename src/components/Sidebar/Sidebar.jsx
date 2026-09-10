// import { X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
// import { NavLink, useLocation, useNavigate } from "react-router-dom";
// import React, { useState, useEffect, useRef } from "react";
// // import logo from "../../assets/rupyMoney.png";
// import shortLogo from "../../assets/shortLogo.svg";
// import {
//   Home,
//   Users,
//   FileText,
//   HelpCircle,
//   Newspaper,
//   MessageSquare,
//   UserPlus,
//   UserMinus,
//   UserCheck,
//   Building2,
//   BookOpen,
//   ClipboardList,
//   ShieldCheck,
//   Settings
// } from "lucide-react";
// import { routes } from "../../routes/routes";

// const ICONS = {
//   Home, FileText, Users, HelpCircle, Newspaper, MessageSquare,
//   UserPlus,
//   UserMinus,
//   UserCheck,
//   Building2,
//   BookOpen,
//   ClipboardList,
//   ShieldCheck,
//   Settings
// };

// function Sidebar({ onClose, collapsed, onToggleCollapse }) {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const [openGroup, setOpenGroup] = useState(null);
//   const [dropdownData, setDropdownData] = useState(null);
//   const buttonRefs = useRef({});
//   const sidebarRef = useRef(null);

//   // Close dropdown if location is not inside the group's children
//   useEffect(() => {
//     const currentRoute = routes.find((r) => r.path === location.pathname);
//     if (currentRoute?.group) {
//       setOpenGroup(currentRoute.group);
//     } else {
//       setOpenGroup(null);
//     }
//   }, [location.pathname]);

//   // Group routes
//   const groupedRoutes = routes
//     .filter((r) => r.showInSidebar)
//     .reduce((acc, route) => {
//       if (route.group) {
//         if (!acc[route.group]) acc[route.group] = { order: route.groupOrder, items: [] };
//         acc[route.group].items.push(route);
//       } else {
//         acc[route.label] = route;
//       }
//       return acc;
//     }, {});

//   // Sort parent and children
//   const sortedGroupedRoutes = Object.entries(groupedRoutes)
//     .sort(([keyA, valueA], [keyB, valueB]) => {
//       const orderA = valueA.items ? valueA.order : valueA.order;
//       const orderB = valueB.items ? valueB.order : valueB.order;
//       return orderA - orderB;
//     })
//     .map(([key, value]) => {
//       if (value.items) {
//         return [key, value.items.sort((a, b) => a.order - b.order)];
//       }
//       return [key, value];
//     });

//   // Handle dropdown toggle and data
//   // const handleGroupClick = (groupName, items) => {
//   //   if (items.length > 0) {
//   //     navigate(items[0].path); 
//   //   }
//   //   if (collapsed) {
//   //     setDropdownData({ groupName, items, key: groupName });
//   //   } else {
//   //     setOpenGroup(openGroup === groupName ? null : groupName);
//   //   }
//   // };

//   const handleGroupClick = (groupName, items) => {
//     if (collapsed) {
//       // Collapsed state -> show dropdown menu only
//       setDropdownData({ groupName, items, key: groupName });
//     } else {
//       if (openGroup === groupName) {
//         // Agar already open hai -> bas band karo
//         setOpenGroup(null);
//       } else {
//         // Agar open nahi hai -> open karo + first child pe le jao
//         setOpenGroup(groupName);
//         if (items.length > 0) {
//           navigate(items[0].path);
//         }
//       }
//     }
//   };

//   // Close dropdown when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (dropdownData && !event.target.closest('.sidebar') && !event.target.closest('.dropdown-menu')) {
//         setDropdownData(null);
//       }
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [dropdownData]);

//   // Get the ref for the clicked button
//   const getClickedButtonRef = () => {
//     if (dropdownData && buttonRefs.current[dropdownData.key]) {
//       return buttonRefs.current[dropdownData.key];
//     }
//     return null;
//   };

//   return (
//     <div
//       ref={sidebarRef}
//       className={`h-full bg-white text-gray-700 flex flex-col shadow-lg transition-all duration-300 ${collapsed ? "w-20" : "w-64"
//         } relative sidebar`}
//     >
//       {/* Header */}
//       <div className="p-[15px] flex justify-between items-center border-b border-gray-200 bg-black">
//         {!collapsed ? (
//           // <img src={logo} alt="Logo" className="w-28 h-auto bg-black" />
//           <h1 className="text-white">SML Moneyview</h1>
//         ) : (
//           // <img src={logo} alt="Logo" className="w-5 h-auto" />
//               <h1 className="text-white">SML Moneyview</h1>
//         )}
//         <div className="flex items-center gap-2">
//           <button
//             onClick={onToggleCollapse}
//             className="text-gray-500 hover:text-primary"
//             title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
//           >
//             {collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
//           </button>
//           <button
//             onClick={onClose}
//             className="md:hidden text-gray-500 hover:text-primary"
//             title="Close Sidebar"
//           >
//             <X size={22} />
//           </button>
//         </div>
//       </div>

//       {/* Nav Links */}
//       <ul className="mt-6 flex-1 px-3 overflow-y-auto">
//         {sortedGroupedRoutes.map(([key, value]) => {
//           if (Array.isArray(value)) {
//             // Group (Dropdown)
//             const groupIcon = ICONS[value[0].icon] || HelpCircle;
//             const itemCount = value.length;
//             return (
//               <li key={key} className="mb-2 relative">
//                 <button
//                   ref={(el) => (buttonRefs.current[key] = el)}
//                   onClick={() => handleGroupClick(key, value)}
//                   // className={`w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all duration-200 font-medium ${
//                   //   openGroup === key && !collapsed
//                   //     ? "bg-gray-600 text-white shadow"
//                   //     : "text-gray-600 hover:bg-gray-200 hover:text-black"
//                   // }`}
//                   className={`w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all duration-200 font-semibold ${openGroup === key && !collapsed
//                       ? "bg-purple-100 text-purple-700"
//                       : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
//                     }`}
//                   title={collapsed ? `${key} (${itemCount})` : ""}
//                 >
//                   <div className="flex items-center gap-2">
//                     {groupIcon && React.createElement(groupIcon, { size: 16 })}
//                     {collapsed ? null : key}
//                   </div>
//                   {!collapsed && <ChevronDown size={16} />}
//                 </button>

//                 {openGroup === key && !collapsed && (
//                   <ul className="ml-2 mt-1 space-y-1">
//                     {value.map((route) => {
//                       const SubIcon = ICONS[route.icon] || HelpCircle;
//                       return (
//                         <li key={route.path}>
//                           <NavLink
//                             to={route.path}
//                             // className={({ isActive }) =>
//                             //   `flex items-center gap-3 px-3 py-1.5 rounded-md text-sm ${
//                             //     isActive
//                             //       ? "bg-primary text-white"
//                             //       : "text-gray-600 hover:bg-gray-200 hover:text-black"
//                             //   }`
//                             // }
//                             className={({ isActive }) =>
//                               `flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors duration-200 ${isActive
//                                 ? "bg-purple-600 text-white shadow-sm"
//                                 : "text-gray-600 hover:bg-purple-50 hover:text-purple-700"
//                               }`
//                             }
//                           >
//                             <SubIcon size={16} />
//                             {route.label}
//                           </NavLink>
//                         </li>
//                       );
//                     })}
//                   </ul>
//                 )}
//               </li>
//             );
//           } else {
//             // Single (Non-grouped)
//             const Icon = ICONS[value.icon] || HelpCircle;
//             return (
//               <li key={value.path} className="mb-2">
//                 <NavLink
//                   to={value.path}
//                   end={value.path === "/"}
//                   // className={({ isActive }) =>
//                   //   `flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
//                   //     isActive
//                   //       ? "bg-primary text-white shadow"
//                   //       : "text-gray-600 hover:bg-gray-200 hover:text-black"
//                   //   }`
//                   // }
//                   className={({ isActive }) =>
//                     `flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 font-medium ${isActive
//                       ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md"
//                       : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
//                     }`
//                   }
//                   title={collapsed ? value.label : ""}
//                 >
//                   {Icon && <Icon size={18} />}
//                   {!collapsed && value.label}
//                 </NavLink>
//               </li>
//             );
//           }
//         })}
//       </ul>

//       {/* {!collapsed && (
//         <div className="p-4 text-xs text-gray-500 border-t border-gray-200">
//           © 2025 Cready CMS
//         </div>
//       )} */}

//       {/* Dropdown Menu */}
//       {dropdownData && collapsed && sidebarRef.current && (
//         <div
//           className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-2 dropdown-menu z-10"
//           style={{
//             top: getClickedButtonRef()?.getBoundingClientRect().top - sidebarRef.current.getBoundingClientRect().top + sidebarRef.current.scrollTop,
//             left: getClickedButtonRef()?.offsetWidth + 5 || 0,
//             width: '200px',
//           }}
//         >
//           <h4 className="font-medium text-gray-700 mb-2">{dropdownData.groupName}</h4>
//           <ul>
//             {dropdownData.items.map((route) => {
//               const SubIcon = ICONS[route.icon] || HelpCircle;
//               return (
//                 <li key={route.path} className="mb-1">
//                   <NavLink
//                     to={route.path}
//                     // className={({ isActive }) =>
//                     //   `flex items-center gap-2 px-2 py-1 rounded-md text-sm ${
//                     //     isActive
//                     //       ? "bg-primary text-white"
//                     //       : "text-gray-600 hover:bg-gray-200 hover:text-black"
//                     //   }`
//                     // }
//                     className={({ isActive }) =>
//                       `flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors duration-200 ${isActive
//                         ? "bg-purple-600 text-white shadow-sm"
//                         : "text-gray-600 hover:bg-purple-50 hover:text-purple-700"
//                       }`
//                     }
//                     onClick={() => setDropdownData(null)}
//                   >
//                     <SubIcon size={16} />
//                     {route.label}
//                   </NavLink>
//                 </li>
//               );
//             })}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// }

// export default Sidebar; 



import { X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";
import { routes } from "../../routes/routes";
import { useAuth } from "../../custom-hooks/useAuth";

import {
  Home,
  Users,
  FileText,
  HelpCircle,
  Newspaper,
  MessageSquare,
  UserPlus,
  UserMinus,
  UserCheck,
  Building2,
  BookOpen,
  ClipboardList,
  ShieldCheck,
  Settings,
  TrendingUp,
  TrendingDown,
  Megaphone,
  Brain,
  FileDown,
  IndianRupee,
  Star,
  Layers,
  Trophy,
  LayoutDashboard,
  Scale
} from "lucide-react";

// NOTE: an `icon` string in routes.js MUST also appear here, or resolution falls
// back to HelpCircle silently. FileDown was already referenced by the Export Logs
// route without being mapped — it has been rendering a question-mark icon.
const ICONS = {
  Home, FileText, Users, HelpCircle, Newspaper, MessageSquare,
  UserPlus, UserMinus, UserCheck, Building2, BookOpen, ClipboardList,
  ShieldCheck, Settings, TrendingUp, TrendingDown, Megaphone, Brain, FileDown, IndianRupee, Star, Trophy, LayoutDashboard, Scale
};

function Sidebar({ onClose, collapsed, onToggleCollapse }) {
  const { user } = useAuth(); // ✅ get logged-in user
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState(null);
  const [dropdownData, setDropdownData] = useState(null);
  const buttonRefs = useRef({});
  const sidebarRef = useRef(null);

  // Filter routes based on user role. `dev` is a super-role → sees every module.
  const allowedRoutes = routes.filter(r => user?.role === 'dev' || r.roles?.includes(user?.role));

  // Close dropdown if location is not inside the group's children
  useEffect(() => {
    const currentRoute = allowedRoutes.find((r) => r.path === location.pathname);
    if (currentRoute?.group) setOpenGroup(currentRoute.group);
    else setOpenGroup(null);
  }, [location.pathname, user]);

  // Group routes
  const groupedRoutes = allowedRoutes
    .filter((r) => r.showInSidebar)
    .reduce((acc, route) => {
      if (route.group) {
        if (!acc[route.group]) acc[route.group] = { order: route.groupOrder, items: [] };
        acc[route.group].items.push(route);
      } else {
        acc[route.label] = route;
      }
      return acc;
    }, {});

  // Sort parent and children
  const sortedGroupedRoutes = Object.entries(groupedRoutes)
    .sort(([keyA, valueA], [keyB, valueB]) => {
      const orderA = valueA.items ? valueA.order : valueA.order;
      const orderB = valueB.items ? valueB.order : valueB.order;
      return orderA - orderB;
    })
    .map(([key, value]) => (value.items ? [key, value.items.sort((a, b) => a.order - b.order)] : [key, value]));

  // Dropdown toggle
  const handleGroupClick = (groupName, items) => {
    if (collapsed) setDropdownData({ groupName, items, key: groupName });
    else {
      if (openGroup === groupName) setOpenGroup(null);
      else {
        setOpenGroup(groupName);
        if (items.length > 0) navigate(items[0].path);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownData && !event.target.closest('.sidebar') && !event.target.closest('.dropdown-menu')) {
        setDropdownData(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownData]);

  const getClickedButtonRef = () => (dropdownData ? buttonRefs.current[dropdownData.key] : null);

  // Pick role label for the footer chip — keeps it lightweight, no extra
  // data fetching. Falls back to "Member" if role unknown.
  const roleLabel = user?.role
    ? user.role.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
    : 'Member';
  const userInitial = (user?.name || user?.email || 'U')[0]?.toUpperCase() || 'U';

  return (
    <div
      ref={sidebarRef}
      className={`relative h-full flex flex-col transition-all duration-300 ${collapsed ? "w-20" : "w-64"} sidebar overflow-hidden text-gray-700`}
    >
      {/* ─── BACKGROUND LAYERS — light premium, blends with white content ─── */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/40 to-white" />
      {/* Soft purple aurora blobs — low opacity so the surface stays bright */}
      <div className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-purple-300/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 w-56 h-56 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 w-64 h-64 rounded-full bg-violet-300/20 blur-3xl" />
      {/* Right edge — gradient border that meets the content nicely */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-200 to-transparent" />

      {/* ─── HEADER ─── */}
      <div className="relative px-3 pt-4 pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo lockup — static.
                Two animations used to run behind it forever: a pulsing purple
                glow and a conic gradient spinning on a 4s loop. Both sat in the
                corner of every screen, on every page, all day. Movement in the
                periphery is a permanent low-level distraction when it never means
                anything, and it kept a compositor layer repainting for decoration. */}
            <div className="relative flex-shrink-0">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/40 ring-1 ring-white/30">
                <span className="text-white text-[15px] font-black tracking-tight drop-shadow">C</span>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow ring-2 ring-white">
                  <span className="text-[7.5px] font-black text-amber-900 leading-none">₹</span>
                </div>
              </div>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-[15px] font-bold tracking-tight leading-tight truncate bg-gradient-to-r from-gray-900 via-purple-800 to-indigo-800 bg-clip-text text-transparent">
                  Cready Portal
                </h1>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
                  </span>
                  <p className="text-[9.5px] font-semibold tracking-[0.14em] uppercase text-emerald-700 leading-none">
                    Landing Page  CMS
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={onToggleCollapse}
              className="text-gray-500 hover:text-purple-700 hover:bg-purple-100/70 p-1.5 rounded-md transition"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              onClick={onClose}
              className="md:hidden text-gray-500 hover:text-purple-700 hover:bg-purple-100/70 p-1.5 rounded-md transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
      </div>

      {/* ─── NAV SECTION LABEL ─── */}
      {!collapsed && (
        <div className="relative px-3 mt-1 mb-2">
          <p className="text-[9.5px] font-bold tracking-[0.18em] uppercase text-purple-400">
            Navigation
          </p>
        </div>
      )}

      <ul className="relative flex-1 px-2 overflow-y-auto pb-4 space-y-0.5">
        {sortedGroupedRoutes.map(([key, value]) => {
          if (Array.isArray(value)) {
            const groupIcon = ICONS[value[0].icon] || HelpCircle;
            const isOpen = openGroup === key && !collapsed;
            const hasActiveChild = value.some((r) => location.pathname === r.path);
            const highlighted = isOpen || hasActiveChild;

            return (
              <li key={key} className="relative">
                <button
                  ref={(el) => (buttonRefs.current[key] = el)}
                  onClick={() => handleGroupClick(key, value)}
                  className={`group relative w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all duration-200 font-semibold text-[13px] ${
                    highlighted
                      ? "bg-gradient-to-r from-purple-100/90 via-purple-50 to-violet-50/70 text-purple-800 border border-purple-200/70 shadow-sm shadow-purple-500/10"
                      : "text-gray-600 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent"
                  }`}
                  title={collapsed ? `${key} (${value.length})` : ""}
                >
                  {/* Left accent bar when active */}
                  {highlighted && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-purple-500 to-indigo-600 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                  )}

                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`relative w-7 h-7 grid place-items-center rounded-lg transition-all flex-shrink-0 ${
                        highlighted
                          ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/40"
                          : "bg-gray-100 text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-700"
                      }`}
                    >
                      {React.createElement(groupIcon, { size: 14 })}
                    </span>
                    {!collapsed && <span className="truncate">{key}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-all duration-200 ${isOpen ? "rotate-180 text-purple-600" : "group-hover:text-purple-500"}`}
                    />
                  )}
                </button>

                {isOpen && (
                  <ul className="mt-1 mb-2 relative pl-3">
                    <span className="absolute left-[15px] top-1 bottom-1 w-px bg-gradient-to-b from-purple-300 via-purple-200 to-transparent" />
                    {value.map((route) => {
                      const SubIcon = ICONS[route.icon] || HelpCircle;
                      return (
                        <li key={route.path} className="relative">
                          <NavLink
                            to={route.path}
                            className={({ isActive }) =>
                              `group relative flex items-center gap-2.5 pl-4 pr-3 py-1.5 my-0.5 rounded-md text-[12px] font-medium transition-all duration-200 ${
                                isActive
                                  ? "bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-md shadow-purple-500/40"
                                  : "text-gray-600 hover:text-purple-700 hover:bg-purple-50/70 hover:translate-x-0.5"
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-purple-600 ring-2 ring-white shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
                                )}
                                <SubIcon size={13} className={isActive ? "text-white" : "text-gray-400 group-hover:text-purple-600"} />
                                <span className="truncate">{route.label}</span>
                              </>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          } else {
            // Single nav item
            const Icon = ICONS[value.icon] || HelpCircle;
            return (
              <li key={value.path}>
                <NavLink
                  to={value.path}
                  end={value.path === "/"}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all duration-200 font-semibold text-[13px] ${
                      isActive
                        ? "bg-gradient-to-r from-purple-100/90 via-purple-50 to-violet-50/70 text-purple-800 border border-purple-200/70 shadow-sm shadow-purple-500/10"
                        : "text-gray-600 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent"
                    }`
                  }
                  title={collapsed ? value.label : ""}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-purple-500 to-indigo-600 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                      )}
                      <span
                        className={`w-7 h-7 grid place-items-center rounded-lg transition-all flex-shrink-0 ${
                          isActive
                            ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/40"
                            : "bg-gray-100 text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-700"
                        }`}
                      >
                        <Icon size={14} />
                      </span>
                      {!collapsed && <span className="truncate">{value.label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            );
          }
        })}
      </ul>

      {/* ─── USER FOOTER ─── */}
      <div className="relative px-2 pb-3">
        <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent mb-2.5" />
        <div className={`flex items-center gap-2.5 px-2 py-2 rounded-lg bg-gradient-to-r from-purple-50/80 to-violet-50/60 border border-purple-200/50 hover:bg-purple-50 transition cursor-default ${collapsed ? 'justify-center' : ''}`}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-purple-400/40 blur-sm" />
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 flex items-center justify-center text-white text-[12px] font-bold shadow-md ring-2 ring-white">
              {userInitial}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-gray-900 truncate leading-tight">
                {user?.name || user?.email?.split('@')[0] || 'Member'}
              </p>
              <p className="text-[9.5px] font-semibold tracking-wider uppercase text-purple-600 truncate leading-none mt-0.5">
                {roleLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
