import { Edit2, Image, Trash2, Eye, Phone } from 'lucide-react';
const S3_IMAGE_PATH = import.meta.env.VITE_IMAGE_URL

// ---------- Cell formatting helpers ----------

// Indian currency format: 1500000 -> ₹15,00,000
const formatINR = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

// 1987-08-08 -> "8 Aug 1987"
const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Calculate age from DOB string
const calcAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// Title-case names: "jay PARIKH" -> "Jay Parikh"
const toTitleCase = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Deterministic color from a string (so same name/purpose always gets same color)
const STRING_COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'bg-purple-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'bg-blue-500' },
  { bg: 'bg-green-100', text: 'text-green-700', ring: 'bg-green-500' },
  { bg: 'bg-pink-100', text: 'text-pink-700', ring: 'bg-pink-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'bg-amber-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'bg-indigo-500' },
  { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'bg-teal-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'bg-rose-500' },
];

const colorFromString = (str) => {
  if (!str) return STRING_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  return STRING_COLORS[Math.abs(hash) % STRING_COLORS.length];
};

// ---------- Offer Leads columns ----------

// tracking_events is a JSON object like { incred_pending_modal_shown: true,
// incred_pending_modal_shown_at: '...' }. Real events are the keys WITHOUT the
// `_at` timestamp suffix. Rendered as a compact count badge (names on hover).
const trackingEventNames = (te) => {
  if (!te || typeof te !== 'object') return [];
  return Object.keys(te)
    .filter((k) => !k.endsWith('_at'))
    .map((k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
};

const TrackingEventsCell = ({ value }) => {
  const names = trackingEventNames(value);
  if (!names.length) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
        0
      </span>
    );
  }
  // Single event → show its name inline; multiple → "N events". Native `title`
  // tooltip lists every event reliably (daisyUI tooltip gets clipped in the
  // table's horizontal scroll container).
  const label = names.length === 1 ? names[0] : `${names.length} events`;
  return (
    <span
      title={names.join(', ')}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 max-w-[200px] truncate cursor-help"
    >
      {label}
    </span>
  );
};

const trackingEventsColumn = {
  header: 'Tracking',
  accessorKey: 'tracking_events',
  cell: ({ getValue }) => <TrackingEventsCell value={getValue()} />,
};

export const offerLeadsColumn = ({ handleEdit, showTracking = false }) => [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ getValue }) => {
      const raw = getValue();
      if (!raw) return <span className="text-gray-400 italic">N/A</span>;
      const display = toTitleCase(raw);
      const colors = colorFromString(display);
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${colors.ring} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
            {getInitials(display)}
          </div>
          <span className="font-medium text-gray-800">{display}</span>
        </div>
      );
    },
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a
          href={`tel:${value}`}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700 transition"
        >
          <Phone size={13} className="text-gray-400" />
          {value}
        </a>
      );
    },
  },
  {
    header: 'Loan Amount',
    accessorKey: 'loan_amount',
    cell: ({ getValue }) => {
      const value = getValue();
      const formatted = formatINR(value);
      if (!formatted) return <span className="text-gray-400 italic">N/A</span>;
      return <span className="font-semibold text-gray-900">{formatted}</span>;
    },
  },
  {
    header: 'Loan Purpose',
    accessorKey: 'loan_purpose',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      const colors = colorFromString(value);
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          {value}
        </span>
      );
    },
  },
  {
    header: 'Medium',
    accessorKey: 'utm_medium',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      const colors = colorFromString(value);
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          {value}
        </span>
      );
    },
  },
  {
    header: 'Monthly Income',
    accessorKey: 'monthly_income',
    cell: ({ getValue }) => {
      const value = getValue();
      const formatted = formatINR(value);
      if (!formatted) return <span className="text-gray-400 italic">N/A</span>;
      return <span className="font-medium text-emerald-700">{formatted}</span>;
    },
  },
  {
    header: 'Feedback Stage',
    accessorKey: 'feedback_status',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) {
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
            Open
          </span>
        );
      }
      const colors = colorFromString(value);
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          {value}
        </span>
      );
    },
  },
  {
    header: 'View All Offers',
    accessorKey: 'view_all_clicked_at',
    cell: ({ getValue }) => {
      // First-click sticky timestamp stamped by /onSubmit/track-view-all-offers.
      // Show a green Clicked badge with the time on hover; grey "Not clicked"
      // when null so the engagement signal is scannable across the table.
      const value = getValue();
      if (!value) {
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Not clicked
          </span>
        );
      }
      const d = new Date(value);
      const dateStr = d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return (
        <div className="tooltip tooltip-top cursor-help" data-tip={dateStr}>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {dateStr}
          </span>
        </div>
      );
    },
  },
  // Tracking events count badge — High Offer Leads only (passed showTracking).
  ...(showTracking ? [trackingEventsColumn] : []),
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => (
      <button
        onClick={() => handleEdit(row.original)}
        className="p-2 rounded-lg hover:bg-purple-100 text-purple-600 transition"
        title="View details"
      >
        <Eye size={18} />
      </button>
    ),
  },
];

// Format full date+time: "8 Apr 2026, 11:49 AM"
const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Render a status pill - colors picked by keyword match against the status string
const renderStatusPill = (value) => {
  if (!value) return <span className="text-gray-400 italic">N/A</span>;
  const lower = String(value).toLowerCase();
  let cls = 'bg-gray-100 text-gray-700';
  if (/(approved|success|eligible|confirmed|active)/.test(lower)) cls = 'bg-green-100 text-green-700';
  else if (/(reject|fail|declined|denied|invalid|error)/.test(lower)) cls = 'bg-red-100 text-red-700';
  else if (/(pending|process|progress|wait|review)/.test(lower)) cls = 'bg-amber-100 text-amber-700';
  else if (/(duplicate|dedup)/.test(lower)) cls = 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
};

export const selectedLendersColumn = ({ handleEdit }) => [
  {
    header: 'Phone Number',
    accessorKey: 'phoneNumber',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a
          href={`tel:${value}`}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700 transition"
        >
          <Phone size={13} className="text-gray-400" />
          {value}
        </a>
      );
    },
  },
  {
    header: 'Lender Name',
    accessorKey: 'lenderName',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      const colors = colorFromString(value);
      return (
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${colors.ring} shrink-0`} />
          <span className="font-medium text-gray-800">{value}</span>
        </div>
      );
    },
  },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ getValue }) => renderStatusPill(getValue()),
  },
  {
    header: 'Created At',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const formatted = formatDateTime(getValue());
      if (!formatted) return <span className="text-gray-400 italic">N/A</span>;
      return <span className="text-sm text-gray-700">{formatted}</span>;
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => (
      <button
        onClick={() => handleEdit(row.original)}
        className="p-2 rounded-lg hover:bg-purple-100 text-purple-600 transition"
        title="View details"
      >
        <Eye size={18} />
      </button>
    ),
  },
];

export const highMisFunnelColumn = () => [
  {
    header: 'Applicant',
    accessorKey: 'name',
    cell: ({ getValue }) => {
      const raw = getValue();
      if (!raw) return <span className="text-gray-400 italic">N/A</span>;
      const display = toTitleCase(raw);
      const colors = colorFromString(display);
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${colors.ring} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
            {getInitials(display)}
          </div>
          <span className="font-medium text-gray-800">{display}</span>
        </div>
      );
    },
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700 transition">
          <Phone size={13} className="text-gray-400" />{v}
        </a>
      );
    },
  },
  {
    header: 'MIS Status',
    accessorKey: 'mis_status',
    cell: ({ getValue }) => {
      const t = String(getValue() ?? '').trim();
      if (!t || t === '-') return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">No Status</span>;
      const l = t.toLowerCase();
      let cls = 'bg-gray-100 text-gray-700';
      if (/(approv|success|disburs|eligible|active|sanction)/.test(l)) cls = 'bg-emerald-100 text-emerald-700';
      else if (/(reject|fail|declin|denied|invalid|error|cancel)/.test(l)) cls = 'bg-rose-100 text-rose-700';
      else if (/(pend|progress|review|process|initiat)/.test(l)) cls = 'bg-amber-100 text-amber-700';
      return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{t}</span>;
    },
  },
  // {
  //   header: 'Rejection Reason',
  //   accessorKey: 'rejection_reason',
  //   cell: ({ getValue }) => {
  //     const v = getValue();
  //     return v ? <span className="text-sm text-gray-700 break-words">{v}</span> : <span className="text-gray-400 italic">N/A</span>;
  //   },
  // },
  {
    header: 'Lender',
    accessorKey: 'lender',
    cell: ({ getValue }) => {
      const v = getValue();
      return v ? <span className="text-sm font-medium text-gray-800">{v}</span> : <span className="text-gray-400 italic">N/A</span>;
    },
  },
  {
    header: 'Lead Type',
    accessorKey: 'lead_type',
    cell: ({ getValue }) => {
      const v = getValue();
      return v ? <span className="text-sm text-gray-700">{v}</span> : <span className="text-gray-400 italic">N/A</span>;
    },
  },
  {
    header: 'Lead Created',
    accessorKey: 'lead_created_dt',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      const d = new Date(v);
      return <span className="text-sm text-gray-600">{Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>;
    },
  },
];

export const blogColumn = ({ handleEdit }) => [
  {
    header: 'Title',
    accessorKey: 'title',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Slug',
    accessorKey: 'slug',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: "Description",
    accessorKey: "description",
    cell: ({ getValue }) => (
      <div
        style={{
          minWidth: "150px",
          maxWidth: "200px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        className="tooltip cursor-pointer "
        data-tip={getValue() || "N/A"}
        title={getValue() || "N/A"}
      >
        {getValue() || "N/A"}
      </div>
    ),
  },
  {
    header: 'Banner',
    accessorKey: 'metaImage',
    cell: info => {
      const imageUrl = info.row.original.metaImage

      if (!imageUrl) {
        return null
      }
      const imagePath = `${S3_IMAGE_PATH}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
      console.log(imagePath, "imagePath")
      return (
        <>
          <img
            src={imagePath}
            alt="blog image"
            onError={(e) => {
              e.currentTarget.src = "https://dummyimage.com/100x50/cccccc/000000&text=No+Image"; // public folder me rakho
            }}
            style={{
              objectFit: 'cover',
              marginBottom: '10px',
              width: '100px',
              height: '50px',
              borderRadius: "0px"
            }}
          />

        </>
      )
    },
  },
  {
    header: 'Status',
    accessorKey: 'isActive',
    cell: ({ getValue }) => {
      const isActive = getValue(); // This returns a boolean: true or false

      // Determine the text and badge color based on the boolean value
      const statusText = isActive ? 'Active' : 'Inactive';
      const badgeColorClass = isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

      return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${badgeColorClass}`}>
          {statusText}
        </span>
      );
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Edit2 size={20} />
          </button>
          {/* <button
            onClick={() => console.log('Delete', row.original)}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <Trash2 size={20} />
          </button> */}
        </div>
      );
    },
  },
];
export const faqColumn = ({ handleEdit }) => [
  {
    header: 'Questions',
    accessorKey: 'question',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: "Answers",
    accessorKey: "answer",
    cell: ({ getValue }) => (
      <div
        style={{
          minWidth: "150px",
          maxWidth: "200px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        className="tooltip cursor-pointer "
        data-tip={getValue() || "N/A"}
        title={getValue() || "N/A"}
      >
        {getValue() || "N/A"}
      </div>
    ),
  },

  {
    header: 'Category',
    accessorKey: 'category_xid',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Featured',
    accessorKey: 'isFeatured',
    cell: ({ getValue }) => getValue() ? 'True' : 'False' || 'N/A',
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Edit2 size={20} />
          </button>
          {/* <button
            onClick={() => console.log('Delete', row.original)}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <Trash2 size={20} />
          </button> */}
        </div>
      );
    },
  },
];
export const testimonialsColumn = ({ handleEdit }) => [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Designation',
    accessorKey: 'designation',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Company',
    accessorKey: 'company',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Edit2 size={20} />
          </button>
          {/* <button
            onClick={() => console.log('Delete', row.original)}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <Trash2 size={20} />
          </button> */}
        </div>
      );
    },
  },
];
export const pressColumn = ({ handleEdit }) => [
  {
    header: 'Title',
    accessorKey: 'title',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Description',
    accessorKey: 'description',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Order',
    accessorKey: 'order',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Edit2 size={20} />
          </button>
          {/* <button
            onClick={() => console.log('Delete', row.original)}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <Trash2 size={20} />
          </button> */}
        </div>
      );
    },
  },
];
export const bannerColumn = ({ handleEdit, handleDelete }) => [
  {
    header: 'Title',
    accessorKey: 'bannerTitle',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Description',
    accessorKey: 'bannerDescription',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Banner',
    accessorKey: 'bannerImage',
    cell: info => {
      const imageUrl = info.row.original.bannerImage

      if (!imageUrl) {
        return null
      }
      const imagePath = `${S3_IMAGE_PATH}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
      console.log(imagePath, "imagePath")
      return (
        <>
          <img src={imagePath} alt=""

            style={{
              objectFit: 'cover',
              marginBottom: '10px',
              width: '100px',
              height: '50px',
            }}
          />

        </>
      )
    },
  },
  {
    header: 'Status',
    accessorKey: 'isActive',
    cell: ({ getValue }) => getValue() ? 'True' : 'False',
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Edit2 size={20} />
          </button>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <Trash2 size={20} />
          </button>
        </div>
      );
    },
  },
];
export const lenderColumn = ({ handleEdit, handleDelete }) => [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Min Amount',
    accessorKey: 'minimumLoanAmount',
    cell: ({ getValue }) => {
      const income = getValue();

      if (income === null || income === undefined || isNaN(income)) {
        return 'N/A';
      }

      const formattedIncome = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(income);

      return formattedIncome;
    },
  },
  {
    header: 'Max Amount',
    accessorKey: 'maximumLoanAmount',
    cell: ({ getValue }) => {
      const income = getValue();

      if (income === null || income === undefined || isNaN(income)) {
        return 'N/A';
      }

      const formattedIncome = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(income);

      return formattedIncome;
    },
  },
  {
    header: 'Min Tenure',
    accessorKey: 'minimumTenure',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Max Tenure',
    accessorKey: 'maximumTenure',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Rate',
    accessorKey: 'startingInterestRate',
    cell: ({ getValue }) => getValue() || 'N/A',
  },


  {
    header: 'Status',
    accessorKey: 'isActive',
    cell: ({ getValue }) => {
      const isActive = getValue(); // This returns a boolean: true or false

      // Determine the text and badge color based on the boolean value
      const statusText = isActive ? 'Active' : 'Inactive';
      const badgeColorClass = isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

      return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${badgeColorClass}`}>
          {statusText}
        </span>
      );
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Edit2 size={20} />
          </button>
          {/* <button
            onClick={() => handleDelete(row.original.id)}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <Trash2 size={20} />
          </button> */}
        </div>
      );
    },
  },
];
export const leadsColumn = ({ handleEdit, handleDelete }) => [
  {
  header: 'SN', // Serial Number
  id: 'sn',
  enableSorting: false, // Serial numbers shouldn't be sortable
  maxSize: 50,
  cell: ({ row, table }) => {
    // 1. Get current pagination state from the table instance
    const { pageIndex, pageSize } = table.getState().pagination;
    
    // 2. Calculate the global row index
    // Formula: (Current Page Index * Page Size) + Row Index on current page + 1
    return (pageIndex * pageSize) + row.index + 1;
  },
},
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ getValue }) => {
      const fullName = getValue();

      return (
        // Apply classes to handle long names
        <div className="w-full overflow-hidden whitespace-normal">
          {fullName.trim() || 'N/A'}
        </div>
      );
    },
  },
  {
    header: 'MoneyView Msg',
    id: 'moneyViewMsg',
    accessorKey: 'message',
    cell: ({ row }) => {
      const message = row.original?.message;
     
      if (!message) {
        return <span className="text-gray-500">N/A</span>;
      }

      // Red Chip for Rejected Lead
      if (message.includes('rejected')) {
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            {message}
          </span>
        );
      }

      // Yellow Chip for Duplicate User
      if (message.includes('Duplicate User (Dedupe)')) {
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-200 px-2 py-1 text-xs font-medium text-yellow-800">
            {message}
          </span>
        );
      }
      if (message.includes('Invalid data to get offer for lead')) {
        return (
          <span className="inline-flex items-center rounded-full bg-orange-200 px-2 py-1 text-xs font-medium text-orange-800">
            {message}
          </span>
        );
      }

      // Green Chip for all other messages (Success/Generic)
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
          {message}
        </span>
      );
    },
  },
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Pan Card',
    accessorKey: 'panNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    accessorKey: 'salary',
    cell: ({ getValue }) => {
      const income = getValue();

      if (income === null || income === undefined || isNaN(income)) {
        return 'N/A';
      }

      const formattedIncome = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(income);

      return formattedIncome;
    },
  },
  {
    header: 'DOB',
    accessorKey: 'fob',
    cell: ({ row }) => {
      const dateStr = row.original.dob;
      if (!dateStr) {
        return 'N/A';
      }

      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const timestamp = getValue();

      if (timestamp && typeof timestamp === 'string' && timestamp.length >= 10) {
        // Get the first 10 characters (YYYY-MM-DD)
        return timestamp.substring(0, 10);
      }

      return timestamp || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
export const kbLogsColumn = ({ handleEdit, handleDelete }) => [
  {
  header: 'SN', // Serial Number
  id: 'sn',
  enableSorting: false, // Serial numbers shouldn't be sortable
  maxSize: 50,
  cell: ({ row, table }) => {
    // 1. Get current pagination state from the table instance
    const { pageIndex, pageSize } = table.getState().pagination;
    
    // 2. Calculate the global row index
    // Formula: (Current Page Index * Page Size) + Row Index on current page + 1
    return (pageIndex * pageSize) + row.index + 1;
  },
},
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ getValue }) => {
      const fullName = getValue();

      return (
        // Apply classes to handle long names
        <div className="w-full overflow-hidden whitespace-normal">
          {fullName.trim() || 'N/A'}
        </div>
      );
    },
  },
  //  {
  //   header: 'KB Msg',
  //   id: 'kbMsg',
  //   accessorKey: 'lender_response',
  //   cell: ({ row }) => {
  //     const message =  row.original.message;
  //     if (!message) {
  //       return <span className="text-gray-500">N/A</span>;
  //     }

  //     // Red Chip for Rejected Lead
  //     if (message.includes('Create leadStatus : Rejected')) {
  //       return (
  //         <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
  //           {message}
  //         </span>
  //       );
  //     }

  //     // Yellow Chip for Duplicate User
  //     if (message.includes('Deduped)')) {
  //       return (
  //         <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
  //           {message}
  //         </span>
  //       );
  //     }
  //     if (message.includes('Age not in valid range' || 'Token creation failed' || 'User pincode in invalid')) {
  //       return (
  //         <span className="inline-flex items-center rounded-full bg-orange-200 px-2 py-1 text-xs font-medium text-orange-800">
  //           {message}
  //         </span>
  //       );
  //     }

  //     // Green Chip for all other messages (Success/Generic)
  //     return (
  //       <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
  //         {message}
  //       </span>
  //     );
  //   },
  // },
  {
  header: 'KB Msg',
  id: 'kbMsg',
  accessorKey: 'lender_response',
  cell: ({ row }) => {
    const message = row.original.message;

    if (!message) {
      return <span className="text-gray-400 italic">N/A</span>;
    }

    // 1. Determine Colors based on message content
    let colorClass = "bg-green-100 text-green-800"; // Default Success

    if (message.includes('Create leadStatus : Rejected')) {
      colorClass = "bg-red-100 text-red-800";
    } else if (message.includes('Deduped') || message.includes('Duplicate Pan')) {
      colorClass = "bg-yellow-100 text-yellow-800";
    } else if (
      ['Age not in valid range', 'Token creation failed', 'User pincode in invalid']
        .some(term => message.includes(term))
    ) {
      colorClass = "bg-orange-200 text-orange-800";
    }

    // 2. Return the Chip with Tooltip logic
    return (
      <div 
        className="tooltip tooltip-top cursor-help " 
        data-tip={message}
      >
        <span className={`
          inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
          max-w-[350px] truncate border border-black/5
          ${colorClass}
        `}>
          {message}
        </span>
      </div>
    );
  },
},
  
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Pan Card',
    accessorKey: 'panNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    accessorKey: 'salary',
    cell: ({ getValue }) => {
      const income = getValue();

      if (income === null || income === undefined || isNaN(income)) {
        return 'N/A';
      }

      const formattedIncome = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(income);

      return formattedIncome;
    },
  },

  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const timestamp = getValue();

      if (timestamp && typeof timestamp === 'string' && timestamp.length >= 10) {
        // Get the first 10 characters (YYYY-MM-DD)
        return timestamp.substring(0, 10);
      }

      return timestamp || 'N/A';
    },
  },
  
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition btn-ghost"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
export const zypeSuccessColumn = ({ handleEdit, handleDelete }) => [
  {
  header: 'SN', // Serial Number
  id: 'sn',
  enableSorting: false, // Serial numbers shouldn't be sortable
  maxSize: 50,
  cell: ({ row, table }) => {
    // 1. Get current pagination state from the table instance
    const { pageIndex, pageSize } = table.getState().pagination;
    
    // 2. Calculate the global row index
    // Formula: (Current Page Index * Page Size) + Row Index on current page + 1
    return (pageIndex * pageSize) + row.index + 1;
  },
},
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ getValue }) => {
      const fullName = getValue();

      return (
        // Apply classes to handle long names
        <div className="w-full overflow-hidden whitespace-normal">
          {fullName.trim() || 'N/A'}
        </div>
      );
    },
  },
 {
  header: "Zype Msg",
  id: "moneyViewMsg",
  accessorKey: "lender_response",
  cell: ({ row }) => {
    const fullMessage =
      row.original.lender_response?.SMLCreadyZype?.message;

    if (!fullMessage) {
      return <span className="text-gray-500">N/A</span>;
    }

    // Extract only LAST word after last ":"
    const message = fullMessage.split(":").pop().trim();

    // Color Map
    const statusMap = [
      { keyword: "REJECT", classes: "bg-red-100 text-red-800" },
      { keyword: "in_progress", classes: "bg-blue-100 text-blue-800" },
      { keyword: "PRE_APPROVAL_IN_PROGRESS", classes: "bg-yellow-100 text-yellow-800" },
    ];

    const match = statusMap.find((s) =>
      message.toLowerCase().includes(s.keyword.toLowerCase())
    );

    const chipClass = match
      ? match.classes
      : "bg-green-100 text-green-800"; // default

    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${chipClass}`}
      >
        {message}
      </span>
    );
  },
},
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Pan Card',
    accessorKey: 'panNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    accessorKey: 'salary',
    cell: ({ getValue }) => {
      const income = getValue();

      if (income === null || income === undefined || isNaN(income)) {
        return 'N/A';
      }

      const formattedIncome = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(income);

      return formattedIncome;
    },
  },
  // {
  //   header: 'DOB',
  //   accessorKey: 'dob',
  //   cell: ({ getValue }) => {
  //     const dateStr = getValue();
  //     if (!dateStr) {
  //       return 'N/A';
  //     }

  //     const date = new Date(dateStr);
  //     const day = String(date.getDate()).padStart(2, '0');
  //     const month = String(date.getMonth() + 1).padStart(2, '0');
  //     const year = date.getFullYear();

  //     return `${day}/${month}/${year}`;
  //   },
  // },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const timestamp = getValue();

      if (timestamp && typeof timestamp === 'string' && timestamp.length >= 10) {
        // Get the first 10 characters (YYYY-MM-DD)
        return timestamp.substring(0, 10);
      }

      return timestamp || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
export const businessColumn = ({ handleEdit, handleDelete }) => [
  {
  header: 'SN', // Serial Number
  id: 'sn',
  enableSorting: false, // Serial numbers shouldn't be sortable
  maxSize: 50,
  cell: ({ row, table }) => {
    // 1. Get current pagination state from the table instance
    const { pageIndex, pageSize } = table.getState().pagination;
    
    // 2. Calculate the global row index
    // Formula: (Current Page Index * Page Size) + Row Index on current page + 1
    return (pageIndex * pageSize) + row.index + 1;
  },
},
  {
    header: 'Company Name',
    accessorKey: 'companyName',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Turnover',
    id: 'turnover',
    accessorKey: 'turnover',
    cell: ({ getValue }) => {
      const value = getValue();

      // If value is missing or empty
      if (!value || value.trim() === '') {
        return <span className="text-gray-500">N/A</span>;
      }

      // Clean spacing and capitalization if needed
      const formatted = value
        .replace(/\s*-\s*/g, ' - ') // normalize spaces around dash
        .replace(/\blakh\b/gi, 'Lakh') // capitalize
        .replace(/\bcrore\b/gi, 'Crore');

      return (
        <div className="font-semibold text-blue-700">
          {formatted}
        </div>
      );
    },
  },
  {
    header: 'Firm Type',
    accessorKey: 'firmType',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Industry',
    accessorKey: 'industryType',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ getValue }) => {
      const fullName = getValue();

      return (
        // Apply classes to handle long names
        <div className="w-full overflow-hidden whitespace-normal">
          {fullName.trim() || 'N/A'}
        </div>
      );
    },
  },
  {
    header: 'Required Loan',
    id: 'requiredLoanAmount',
    accessorKey: 'requiredLoanAmount',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-red-500 font-medium">Not Specified</span>;

      const formatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(value);

      return (
        <div className="font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full inline-block">
          {formatted}
        </div>
      );
    },
  },

  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },



  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const timestamp = getValue();

      if (timestamp && typeof timestamp === 'string' && timestamp.length >= 10) {
        // Get the first 10 characters (YYYY-MM-DD)
        return timestamp.substring(0, 10);
      }

      return timestamp || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
export const ivrLogsColumn = ({ handleEdit, handleDelete }) => [
  {
  header: 'SN', // Serial Number
  id: 'sn',
  enableSorting: false, // Serial numbers shouldn't be sortable
  maxSize: 50,
  cell: ({ row, table }) => {
    // 1. Get current pagination state from the table instance
    const { pageIndex, pageSize } = table.getState().pagination;
    
    // 2. Calculate the global row index
    // Formula: (Current Page Index * Page Size) + Row Index on current page + 1
    return (pageIndex * pageSize) + row.index + 1;
  },
},
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ getValue }) => {
      const fullName = getValue();

      return (
        // Apply classes to handle long names
        <div className="w-full overflow-hidden whitespace-normal">
          {fullName.trim() || 'N/A'}
        </div>
      );
    },
  },
  {
    header: 'MoneyView Msg',
    id: 'moneyViewMsg',
    accessorKey: 'lender_response',
    cell: ({ row }) => {
      const message = row.original.lender_response?.MoneyView?.message;
      if (!message) {
        return <span className="text-gray-500">N/A</span>;
      }

      // Red Chip for Rejected Lead
      if (message.includes('Lead has been rejected')) {
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            {message}
          </span>
        );
      }

      // Yellow Chip for Duplicate User
      if (message.includes('Duplicate User (Dedupe)')) {
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
            {message}
          </span>
        );
      }
      if (message.includes('Invalid data to get offer for lead')) {
        return (
          <span className="inline-flex items-center rounded-full bg-orange-200 px-2 py-1 text-xs font-medium text-orange-800">
            {message}
          </span>
        );
      }

      // Green Chip for all other messages (Success/Generic)
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
          {message}
        </span>
      );
    },
  },
  
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    id: 'salary',
    accessorKey: 'salary',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-red-500 font-medium">Not Specified</span>;

      return (
        <div className="font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full inline-block">
          {value}
        </div>
      );
    },
  },
    {
    header: 'Profession',
    accessorKey: 'profession',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
    {
    header: 'Pan Number',
    accessorKey: 'panNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
 
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const timestamp = getValue();

      if (timestamp && typeof timestamp === 'string' && timestamp.length >= 10) {
        // Get the first 10 characters (YYYY-MM-DD)
        return timestamp.substring(0, 10);
      }

      return timestamp || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
export const signInColumns = ({ handleEdit, handleDelete }) => [
  {
    header: 'First Name',
    accessorKey: 'firstName',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Last Name',
    accessorKey: 'lastName',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Number',
    accessorKey: 'phoneNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Gender',
    accessorKey: 'gender',
    cell: ({ getValue }) => {
      const genderValue = getValue();
      // Normalize the value to a consistent case (e.g., lowercase)
      const normalizedGender = typeof genderValue === 'string' ? genderValue.toLowerCase() : genderValue;

      // Check for "male" or "female" using the normalized value
      const isMale = normalizedGender === 'male';
      const isFemale = normalizedGender === 'female';

      let genderText = 'N/A';
      let badgeColorClass = 'bg-gray-100 text-gray-800'; // Default for N/A

      if (isMale) {
        genderText = 'Male';
        badgeColorClass = 'bg-blue-100 text-blue-800';
      } else if (isFemale) {
        genderText = 'Female';
        badgeColorClass = 'bg-pink-100 text-pink-800';
      }

      return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${badgeColorClass}`}>
          {genderText}
        </span>
      );
    },
  },
  {
    header: 'Job Type',
    accessorKey: 'jobType',
    cell: ({ getValue }) => {
      const jobType = getValue();

      // Function to convert to Title Case
      const toTitleCase = (str) => {
        if (!str) return 'N/A';
        return str
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };

      const formattedJobType = toTitleCase(jobType);

      // Define a mapping of job types to badge styles
      const badgeStyles = {
        'Salaried': 'bg-blue-100 text-blue-800',
        'Self-Employed': 'bg-green-100 text-green-800',
        'Self-employed': 'bg-green-100 text-green-800',
        'Business Owner': 'bg-purple-100 text-purple-800',
        'Freelancer': 'bg-yellow-100 text-yellow-800',
        'Student': 'bg-indigo-100 text-indigo-800',
        'Other': 'bg-gray-100 text-gray-800',
      };

      // Get the style for the formatted job type, defaulting to 'Other'
      const style = badgeStyles[formattedJobType] || badgeStyles['Other'];

      return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${style}`}>
          {formattedJobType}
        </span>
      );
    },
  },
  {
    header: 'Income',
    accessorKey: 'monthlyIncome',
    cell: ({ getValue }) => {
      const income = getValue();

      if (income === null || income === undefined || isNaN(income)) {
        return 'N/A';
      }

      const formattedIncome = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(income);

      return formattedIncome;
    },
  },
  {
    header: 'DOB',
    accessorKey: 'dateOfBirth',
    cell: ({ getValue }) => {
      const dateStr = getValue();
      if (!dateStr) {
        return 'N/A';
      }

      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
export const archiveColumns = ({ handleEdit, handleDelete }) => [
  {
    header: 'FirstName',
    accessorKey: 'firstName',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'LastName',
    accessorKey: 'lastName',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'phoneNumber',
    accessorKey: 'phoneNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'BioMetric',
    accessorKey: 'isBioMetricEnabled',
    cell: ({ getValue }) => getValue() ? 'True' : 'False',
  },
  {
    header: 'Mpin Enabled',
    accessorKey: 'isMpinEnabled',
    cell: ({ getValue }) => getValue() ? 'True' : 'False',
  },
  {
    header: 'Email Verified',
    accessorKey: 'isEmailVerified',
    cell: ({ getValue }) => getValue() ? 'True' : 'False',
  },

  {
    header: 'Phone Verified',
    accessorKey: 'isPhoneVerified',
    cell: ({ getValue }) => (
      <span className="flex space-x-3">
        {getValue() ? (
          <span className="p-2 font-semibold">Active</span>
        ) : (
          <span className="p-2 font-semibold">Inactive</span>
        )}
      </span>
    )
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition"
          >
            <Eye size={20} />
          </button>
        </div>
      );
    },
  },
];
// MV Success Leads column set — mirrors kbLendingPageColumn 1:1, but reads
// from the offerLeads schema (name / phone / pan_no / monthly_income) and pulls
// the MV message out of the lender_response JSON column.
export const mvOfferLeadsColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (pageIndex * pageSize) + row.index + 1;
    },
  },
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName || row.first_name || ''} ${row.lastName || row.last_name || ''}`,
    cell: ({ getValue }) => (
      <div className="w-full overflow-hidden whitespace-normal">
        {(getValue() || '').trim() || 'N/A'}
      </div>
    ),
  },
  {
    header: 'MV Msg',
    id: 'mvMsg',
    accessorFn: (row) => row?.message || row?.lender_response?.MoneyView?.message || null,
    cell: ({ getValue, row }) => {
      const message = getValue();
      // Badge label + color both driven by the canonical mv_apply_status
      // column. Raw MV message (e.g. "No duplicate found") is preserved in
      // the tooltip so it's still accessible when needed.
      const status = row.original?.mv_apply_status || null;

      if (!status && !message) {
        return <span className="text-gray-400 italic">N/A</span>;
      }

      const STATUS_META = {
        success: { label: 'Success', color: 'bg-green-100 text-green-800' },
        reject: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
        duplicate: { label: 'Duplicate', color: 'bg-yellow-100 text-yellow-800' },
        error: { label: 'Error', color: 'bg-orange-200 text-orange-800' },
      };
      const meta = STATUS_META[status];
      const label = meta?.label || message;
      const colorClass = meta?.color || 'bg-gray-100 text-gray-700';

      return (
        <div className="tooltip tooltip-top cursor-help" data-tip={message || label}>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium max-w-[350px] truncate border border-black/5 ${colorClass}`}>
            {label}
          </span>
        </div>
      );
    },
  },
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Pan Card',
    id: 'panCard',
    accessorFn: (row) => row.panNumber || row.pan_no || '',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    id: 'salary',
    accessorFn: (row) => row.salary ?? row.monthly_income,
    cell: ({ getValue }) => {
      const income = getValue();
      if (income === null || income === undefined || isNaN(income)) return 'N/A';
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(income);
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const ts = getValue();
      if (ts && typeof ts === 'string' && ts.length >= 10) return ts.substring(0, 10);
      return ts || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => (
      <div className="flex space-x-3">
        <button onClick={() => handleEdit(row.original)} className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition btn-ghost">
          <Eye size={20} />
        </button>
      </div>
    ),
  },
];

// SC Response Leads column set — like mvOfferLeadsColumn, but the badge is driven
// by the derived `scStatus` (classified from lender_response.smartCoin on the
// backend). Shows EVERY SmartCoin response (success / rejected / duplicate / error).
export const scResponseLeadsColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (pageIndex * pageSize) + row.index + 1;
    },
  },
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName || row.first_name || ''} ${row.lastName || row.last_name || ''}`,
    cell: ({ getValue, row }) => (
      <div className="w-full overflow-hidden whitespace-normal">
        {(getValue() || '').trim() || row.original?.name || 'N/A'}
      </div>
    ),
  },
  {
    header: 'SC Status',
    id: 'scStatus',
    accessorFn: (row) => row?.scStatus || null,
    cell: ({ row }) => {
      const status = row.original?.scStatus || null;
      const message = row.original?.scMessage || row.original?.lender_response?.smartCoin?.message || '';

      if (!status && !message) {
        return <span className="text-gray-400 italic">N/A</span>;
      }

      const STATUS_META = {
        success: { label: 'Success', color: 'bg-green-100 text-green-800' },
        reject: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
        duplicate: { label: 'Duplicate', color: 'bg-yellow-100 text-yellow-800' },
        error: { label: 'Error', color: 'bg-orange-200 text-orange-800' },
      };
      const meta = STATUS_META[status];
      const label = meta?.label || message || 'N/A';
      const colorClass = meta?.color || 'bg-gray-100 text-gray-700';

      return (
        <div className="tooltip tooltip-top cursor-help" data-tip={message || label}>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium max-w-[350px] truncate border border-black/5 ${colorClass}`}>
            {label}
          </span>
        </div>
      );
    },
  },
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Pan Card',
    id: 'panCard',
    accessorFn: (row) => row.panNumber || row.pan_no || '',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    id: 'salary',
    accessorFn: (row) => row.salary ?? row.monthly_income,
    cell: ({ getValue }) => {
      const income = getValue();
      if (income === null || income === undefined || isNaN(income)) return 'N/A';
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(income);
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const ts = getValue();
      if (ts && typeof ts === 'string' && ts.length >= 10) return ts.substring(0, 10);
      return ts || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => (
      <div className="flex space-x-3">
        <button onClick={() => handleEdit(row.original)} className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition btn-ghost">
          <Eye size={20} />
        </button>
      </div>
    ),
  },
];

export const kbLendingPageColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (pageIndex * pageSize) + row.index + 1;
    },
  },
  {
    header: 'Full Name',
    id: 'fullName',
    maxSize: 100,
    accessorFn: (row) => `${row.firstName || ''} ${row.lastName || ''}`,
    cell: ({ getValue }) => (
      <div className="w-full overflow-hidden whitespace-normal">
        {getValue().trim() || 'N/A'}
      </div>
    ),
  },
  {
    header: 'KB Msg',
    id: 'kbMsg',
    accessorFn: (row) => row?.lender_response?.KreditBee?.message || row?.message || '',
    cell: ({ row }) => {
      const message =
        row.original?.lender_response?.KreditBee?.message ||
        row.original?.message;
      // Badge label + color both driven by the canonical kb_apply_status
      // column written by /kreditbee. Raw KB message stays in the tooltip.
      const status = row.original?.kb_apply_status || null;

      if (!status && !message) {
        return <span className="text-gray-400 italic">N/A</span>;
      }

      const STATUS_META = {
        success: { label: 'Success', color: 'bg-green-100 text-green-800' },
        reject: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
        duplicate: { label: 'Duplicate', color: 'bg-yellow-100 text-yellow-800' },
        error: { label: 'Error', color: 'bg-orange-200 text-orange-800' },
      };
      const meta = STATUS_META[status];
      const label = meta?.label || message;
      const colorClass = meta?.color || 'bg-gray-100 text-gray-700';

      return (
        <div className="tooltip tooltip-top cursor-help" data-tip={message || label}>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium max-w-[350px] truncate border border-black/5 ${colorClass}`}>
            {label}
          </span>
        </div>
      );
    },
  },
  {
    header: 'Number',
    accessorKey: 'phone',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Pan Card',
    accessorKey: 'panNumber',
    cell: ({ getValue }) => getValue() || 'N/A',
  },
  {
    header: 'Salary',
    accessorKey: 'salary',
    cell: ({ getValue }) => {
      const income = getValue();
      if (income === null || income === undefined || isNaN(income)) return 'N/A';
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(income);
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const ts = getValue();
      if (ts && typeof ts === 'string' && ts.length >= 10) return ts.substring(0, 10);
      return ts || 'N/A';
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => (
      <div className="flex space-x-3">
        <button onClick={() => handleEdit(row.original)} className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition btn-ghost">
          <Eye size={20} />
        </button>
      </div>
    ),
  },
];
export const draftLeadsNewColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (
        <span className="text-xs font-medium text-gray-500">
          {(pageIndex * pageSize) + row.index + 1}
        </span>
      );
    },
  },
  {
    header: 'Full Name',
    id: 'fullName',
    accessorFn: (row) => row.fullname || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    cell: ({ getValue }) => {
      const raw = getValue();
      if (!raw) return <span className="text-gray-400 italic">N/A</span>;
      const display = toTitleCase(raw);
      const colors = colorFromString(display);
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${colors.ring} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
            {getInitials(display)}
          </div>
          <span className="font-medium text-gray-800 whitespace-nowrap">{display}</span>
        </div>
      );
    },
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a
          href={`tel:${value}`}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700 transition"
        >
          <Phone size={13} className="text-gray-400" />
          {value}
        </a>
      );
    },
  },
  {
    header: 'Email',
    accessorKey: 'email',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a
          href={`mailto:${value}`}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition"
        >
          {value}
        </a>
      );
    },
  },
  {
    header: 'PAN',
    accessorKey: 'panNumber',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
          {String(value).toUpperCase()}
        </span>
      );
    },
  },
  {
    header: 'Salary',
    accessorKey: 'salary',
    cell: ({ getValue }) => {
      const formatted = formatINR(getValue());
      if (!formatted) return <span className="text-gray-400 italic">N/A</span>;
      return <span className="font-medium text-emerald-700">{formatted}</span>;
    },
  },
  {
    header: 'Loan Amt',
    accessorKey: 'loanAmount',
    cell: ({ getValue }) => {
      const formatted = formatINR(getValue());
      if (!formatted) return <span className="text-gray-400 italic">N/A</span>;
      return <span className="font-semibold text-gray-900">{formatted}</span>;
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => {
      const formatted = formatDate(getValue());
      if (!formatted) return <span className="text-gray-400 italic">N/A</span>;
      return <span className="text-sm text-gray-700 whitespace-nowrap">{formatted}</span>;
    },
  },
  {
    header: 'Actions',
    accessorKey: 'actions',
    cell: ({ row }) => (
      <button
        onClick={() => handleEdit(row.original)}
        className="p-2 rounded-lg hover:bg-purple-100 text-purple-600 transition"
        title="View details"
      >
        <Eye size={18} />
      </button>
    ),
  },
];

// ---------- Lending User Journey columns ----------
// Simple 4-step status display: Landed, OTP, Submitted, Lender Clicked.
// Green check = done, gray dash = not done. Plus a date tooltip on hover.

const formatDateTimeShort = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
};

// Compact "Yes with timestamp" / "No" cell for each of the 4 steps.
const StatusCell = ({ done, at }) => {
  if (!done) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400" title="Not done">
        —
      </span>
    );
  }
  const timeStr = formatDateTimeShort(at);
  return (
    <div className="flex items-center gap-1.5" title={timeStr || 'Done'}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3.5 8.5 6.5 11.5 12.5 5" />
        </svg>
      </span>
      {timeStr && <span className="text-[11px] text-gray-600 whitespace-nowrap">{timeStr}</span>}
    </div>
  );
};

export const lendingUserJourneyColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (
        <span className="text-xs font-medium text-gray-500">
          {(pageIndex * pageSize) + row.index + 1}
        </span>
      );
    },
  },
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ getValue }) => {
      const raw = getValue();
      if (!raw) return <span className="text-gray-400 italic">N/A</span>;
      const display = toTitleCase(raw);
      const colors = colorFromString(display);
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${colors.ring} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
            {getInitials(display)}
          </div>
          <span className="font-medium text-gray-800 whitespace-nowrap">{display}</span>
        </div>
      );
    },
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700">
          <Phone size={13} className="text-gray-400" />{v}
        </a>
      );
    },
  },
  // Step 1 — Landed (always true for rows that appear here, since draft is the anchor)
  {
    header: '1. Landed',
    accessorKey: 'drafted_at',
    cell: ({ getValue }) => <StatusCell done={!!getValue()} at={getValue()} />,
  },
  // Step 2 — OTP verified
  {
    header: '2. OTP Verified',
    accessorKey: 'has_otp_verified',
    cell: ({ row }) => (
      <StatusCell
        done={!!row.original.has_otp_verified}
        at={row.original.otp_verified_at}
      />
    ),
  },
  // Step 3 — Form submitted (offerLeads entry)
  {
    header: '3. Form Submitted',
    accessorKey: 'submitted_at',
    cell: ({ getValue }) => <StatusCell done={!!getValue()} at={getValue()} />,
  },
  // Step 4 — Lender chosen
  {
    header: '4. Lender Chosen',
    accessorKey: 'lenders_clicked',
    cell: ({ getValue, row }) => {
      const names = getValue();
      const count = row.original.lenders_count || 0;
      if (!names) {
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400" title="No lender chosen">
            —
          </span>
        );
      }
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-green-700 truncate max-w-[220px]" title={names}>{names}</span>
          <span className="text-[10px] text-gray-500">{count} click{count === 1 ? '' : 's'}</span>
        </div>
      );
    },
  },
  {
    header: 'Action',
    id: 'actions-journey',
    cell: ({ row }) => (
      <button
        onClick={() => handleEdit(row.original)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition"
        title="View full history"
      >
        <Eye size={14} /> View
      </button>
    ),
  },
];

// Short User Track — same shape as userTrackColumn but anchored on
// short_apply_new_draft_leads (one row per phone). Re-uses the same data
// keys (first_name, last_name, phone, email, first_seen_at,
// has_otp_verified, otp_verified_at) since the short backend exposes them
// identically.
export const shortUserTrackColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (
        <span className="text-xs font-medium text-gray-500">
          {(pageIndex * pageSize) + row.index + 1}
        </span>
      );
    },
  },
  {
    header: 'Name',
    accessorKey: 'fullname',
    cell: ({ row }) => {
      const raw = [row.original.first_name, row.original.last_name].filter(Boolean).join(' ');
      if (!raw) return <span className="text-gray-400 italic">N/A</span>;
      const display = toTitleCase(raw);
      const colors = colorFromString(display);
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${colors.ring} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
            {getInitials(display)}
          </div>
          <span className="font-medium text-gray-800 whitespace-nowrap">{display}</span>
        </div>
      );
    },
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700">
          <Phone size={13} className="text-gray-400" />{v}
        </a>
      );
    },
  },
  {
    header: 'Email',
    accessorKey: 'email',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <div className="max-w-[150px] truncate text-sm text-gray-700" title={v}>
          {v}
        </div>
      );
    },
  },
  {
    header: '1. Landed',
    accessorKey: 'first_seen_at',
    cell: ({ getValue }) => <StatusCell done={!!getValue()} at={getValue()} />,
  },
  {
    header: '2. OTP Verified',
    accessorKey: 'has_otp_verified',
    cell: ({ row }) => (
      <StatusCell
        done={!!row.original.has_otp_verified}
        at={row.original.otp_verified_at}
      />
    ),
  },
  {
    header: 'Action',
    id: 'actions-short-user-track',
    cell: ({ row }) => (
      <button
        onClick={() => handleEdit(row.original)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition"
        title="View details"
      >
        <Eye size={14} /> View
      </button>
    ),
  },
];

// User Track — scoped only to apply_new_draft_leads, grouped by phone.
// Columns focus on the two stages we currently track: landed + OTP verified.
export const userTrackColumn = ({ handleEdit }) => [
  {
    header: 'SN',
    id: 'sn',
    enableSorting: false,
    maxSize: 50,
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      return (
        <span className="text-xs font-medium text-gray-500">
          {(pageIndex * pageSize) + row.index + 1}
        </span>
      );
    },
  },
  {
    header: 'Name',
    accessorKey: 'fullname',
    cell: ({ row }) => {
      const raw =[row.original.first_name, row.original.last_name].filter(Boolean).join(' ');
      if (!raw) return <span className="text-gray-400 italic">N/A</span>;
      const display = toTitleCase(raw);
      const colors = colorFromString(display);
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full ${colors.ring} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
            {getInitials(display)}
          </div>
          <span className="font-medium text-gray-800 whitespace-nowrap">{display}</span>
        </div>
      );
    },
  },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-gray-400 italic">N/A</span>;
      return (
        <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700">
          <Phone size={13} className="text-gray-400" />{v}
        </a>
      );
    },
  },
  {
      header: 'Email',
      accessorKey: 'email',
      cell: ({ getValue }) => {
        const v = getValue();
        if (!v) return <span className="text-gray-400 italic">N/A</span>;
        return (
          <div className="max-w-[150px] truncate text-sm text-gray-700" title={v}>
            {v}
          </div>
        );
      },
    },
  // Step 1 — Landed (always true for rows that appear here; first_seen_at = first draft)
  {
    header: '1. Landed',
    accessorKey: 'first_seen_at',
    cell: ({ getValue }) => <StatusCell done={!!getValue()} at={getValue()} />,
  },
  // Step 2 — OTP verified
  {
    header: '2. OTP Verified',
    accessorKey: 'has_otp_verified',
    cell: ({ row }) => (
      <StatusCell
        done={!!row.original.has_otp_verified}
        at={row.original.otp_verified_at}
      />
    ),
  },
  // View All Offers click — derived from offerLeads.view_all_clicked_at via the
  // base CTE. Renders a green "Clicked" pill (with timestamp on hover) when the
  // applicant pressed the "View All Offers" CTA on the offers page; otherwise
  // a muted "Not clicked" pill.
  {
    header: 'View All Offers',
    accessorKey: 'view_all_clicked_at',
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) {
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Not clicked
          </span>
        );
      }
      const d = new Date(value);
      const dateStr = d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return (
        <div className="tooltip tooltip-top cursor-help" data-tip={dateStr}>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {dateStr}
          </span>
        </div>
      );
    },
  },

  // Tracking events count badge (latest offerLeads.tracking_events for the phone).
  trackingEventsColumn,
  {
    header: 'Action',
    id: 'actions-user-track',
    cell: ({ row }) => (
      <button
        onClick={() => handleEdit(row.original)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition"
        title="View details"
      >
        <Eye size={14} /> View
      </button>
    ),
  },
];

// ---- Vivifi (FlexSalary) webhook leads ------------------------------------
// Shared cell helpers for the applications + loans snapshot tables. Statuses are
// free-form strings from FlexSalary (e.g. "Disbursed", "Rejected", "Awaiting
// VKYC"), so we colour a badge by keyword rather than an enum.
const vivifiStatusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (/disburs|approved|success|complete|active/.test(s)) return 'bg-green-100 text-green-800 border-green-200';
  if (/reject|declin|fail|cancel|expire/.test(s)) return 'bg-red-100 text-red-800 border-red-200';
  if (/pending|await|progress|review|initiat|process|vkyc|esign|sign/.test(s)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const vivifiStatusBadge = (status) => {
  if (!status) return <span className="text-gray-400 italic">N/A</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${vivifiStatusClass(status)}`}>
      {status}
    </span>
  );
};

// ClickHouse returns 'YYYY-MM-DD HH:MM:SS(.sss)' already in IST wall-clock — show
// it as-is (trimmed to minutes) rather than re-parsing through the browser TZ.
const vivifiFmtDateTime = (v) => {
  if (!v) return '—';
  const s = String(v).replace('T', ' ');
  return s.length >= 16 ? s.slice(0, 16) : s;
};

const vivifiFmtInr = (v) => {
  if (v === null || v === undefined || v === '' || isNaN(v)) return <span className="text-gray-400 italic">—</span>;
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

const vivifiPhoneCell = ({ getValue }) => {
  const v = getValue();
  if (!v) return <span className="text-gray-400 italic">N/A</span>;
  return (
    <a href={`tel:${v}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-700 hover:text-purple-700">
      <Phone size={13} className="text-gray-400" />{v}
    </a>
  );
};

const vivifiSnCell = ({ row, table }) => {
  const { pageIndex, pageSize } = table.getState().pagination;
  return <span className="text-xs font-medium text-gray-500">{(pageIndex * pageSize) + row.index + 1}</span>;
};

const vivifiEyeCell = (handleEdit, title) => ({ row }) => (
  <div className="flex space-x-3">
    <button onClick={() => handleEdit(row.original)} className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition btn-ghost" title={title}>
      <Eye size={20} />
    </button>
  </div>
);

// Applications snapshot — current-state, one row per lead (webhook_data.applications FINAL).
export const vivifiApplicationsColumn = ({ handleEdit }) => [
  { header: 'SN', id: 'sn', enableSorting: false, maxSize: 50, cell: vivifiSnCell },
  {
    header: 'Lead ID',
    accessorKey: 'leadId',
    // Long opaque hash — cap the width and ellipsis it; full value on hover (title).
    cell: ({ getValue }) => {
      const v = getValue();
      return v
        ? <span className="font-mono text-sm font-medium text-gray-800 inline-block max-w-[130px] truncate align-middle" title={v}>{v}</span>
        : <span className="text-gray-400 italic">N/A</span>;
    },
  },
  { header: 'Eligible Amt', accessorKey: 'eligibleAmount', cell: ({ getValue }) => getValue() || 'N/A' },
  { header: 'Phone', accessorKey: 'phone', cell: vivifiPhoneCell },
  { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => vivifiStatusBadge(getValue()) },
  // {
  //   header: 'Rejection Reason',
  //   accessorKey: 'rejectionReason',
  //   cell: ({ getValue }) => {
  //     const v = getValue();
  //     return v
  //       ? <span className="max-w-[280px] truncate inline-block text-sm text-gray-700 align-middle" title={v}>{v}</span>
  //       : <span className="text-gray-400 italic">—</span>;
  //   },
  // },
  { header: 'Updated At', accessorKey: 'updatedAt', cell: ({ getValue }) => <span className="text-sm text-gray-600">{vivifiFmtDateTime(getValue())}</span> },
  { header: 'Actions', id: 'actions-vivifi-app', cell: vivifiEyeCell(handleEdit, 'View timeline') },
];

// Loans snapshot — current-state disbursal view (webhook_data.loans FINAL).
export const vivifiLoansColumn = ({ handleEdit }) => [
  { header: 'SN', id: 'sn', enableSorting: false, maxSize: 50, cell: vivifiSnCell },
  {
    header: 'Lead ID',
    accessorKey: 'leadId',
    // Long opaque hash — cap the width and ellipsis it; full value on hover (title).
    cell: ({ getValue }) => {
      const v = getValue();
      return v
        ? <span className="font-mono text-sm font-medium text-gray-800 inline-block max-w-[130px] truncate align-middle" title={v}>{v}</span>
        : <span className="text-gray-400 italic">N/A</span>;
    },
  },
  { header: 'Phone', accessorKey: 'phoneNumber', cell: vivifiPhoneCell },
  { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => vivifiStatusBadge(getValue()) },
  { header: 'Amount', accessorKey: 'amount', cell: ({ getValue }) => vivifiFmtInr(getValue()) },
  { header: 'Disbursed', accessorKey: 'disbursalAmount', cell: ({ getValue }) => vivifiFmtInr(getValue()) },
  { header: 'Disbursal Date', accessorKey: 'disbursalDate', cell: ({ getValue }) => <span className="text-sm text-gray-600">{vivifiFmtDateTime(getValue())}</span> },
  { header: 'Updated At', accessorKey: 'updatedAt', cell: ({ getValue }) => <span className="text-sm text-gray-600">{vivifiFmtDateTime(getValue())}</span> },
  { header: 'Actions', id: 'actions-vivifi-loan', cell: vivifiEyeCell(handleEdit, 'View timeline') },
];

// Truncate long opaque hashes (pci / event_id) with the full value on hover.
const upSwingTruncCell = ({ getValue }) => {
  const v = getValue();
  if (!v) return <span className="text-gray-400 italic">—</span>;
  const s = String(v);
  return <span className="font-mono text-xs text-gray-600" title={s}>{s.length > 16 ? `${s.slice(0, 12)}…` : s}</span>;
};

// UpSwing leads — one row per pci from ClickHouse upswing.pci_latest_event: the
// lead's current journey stage (eventType) plus its offer / selection / disbursal
// figures. eventType reuses the Vivifi status badge for stage colours.
export const upSwingEventsColumn = ({ handleEdit }) => [
  { header: 'SN', id: 'sn', enableSorting: false, maxSize: 50, cell: vivifiSnCell },
  { header: 'PCI', accessorKey: 'pci', cell: upSwingTruncCell },
  {
    header: 'Phone',
    accessorKey: 'phone',
    cell: ({ row }) => {
      const ph = row.original.phone;
      const mrn = row.original.mrn;
      if (!ph && !mrn) return <span className="text-gray-400 italic">—</span>;
      return (
        <div className="leading-tight">
          {ph
            ? <a href={`tel:${ph}`} className="font-mono text-sm text-purple-600 hover:underline">{ph}</a>
            : <span className="text-gray-400 italic">—</span>}
          {mrn && <div className="text-[11px] text-gray-500 font-mono">MRN {mrn}</div>}
        </div>
      );
    },
  },
  { header: 'Stage', accessorKey: 'eventType', cell: ({ getValue }) => vivifiStatusBadge(getValue()) },
  {
    header: 'Product',
    accessorKey: 'productVariant',
    cell: ({ row }) => {
      const pv = row.original.productVariant;
      const jt = row.original.journeyType;
      if (!pv && !jt) return <span className="text-gray-400 italic">—</span>;
      return (
        <div className="leading-tight">
          {pv && <div className="text-sm font-medium text-gray-800">{pv}</div>}
          {jt && <div className="text-[11px] text-gray-500">{jt}</div>}
        </div>
      );
    },
  },
  {
    header: 'Bank Offer',
    accessorKey: 'bankOfferedAmount',
    cell: ({ row }) => {
      const amt = row.original.bankOfferedAmount;
      const roi = row.original.bankOfferedInterest;
      if (amt == null) return <span className="text-gray-400 italic">—</span>;
      return (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-800">{vivifiFmtInr(amt)}</div>
          {roi != null && <div className="text-[11px] text-gray-500">{roi}% p.a.</div>}
        </div>
      );
    },
  },
  // {
  //   header: 'Selected',
  //   accessorKey: 'userSelectedLoanAmount',
  //   cell: ({ getValue }) => vivifiFmtInr(getValue()),
  // },
  {
    header: 'Disbursed',
    accessorKey: 'loanDisbursalAmount',
    cell: ({ getValue }) => {
      const v = getValue();
      return v == null
        ? <span className="text-gray-400 italic">—</span>
        : <span className="text-sm font-semibold text-emerald-700">{vivifiFmtInr(v)}</span>;
    },
  },
  { header: 'Last Event', accessorKey: 'eventTimestamp', cell: ({ getValue }) => <span className="text-sm text-gray-600">{vivifiFmtDateTime(getValue())}</span> },
  { header: 'Actions', id: 'actions-upswing', cell: vivifiEyeCell(handleEdit, 'View lead detail') },
];