// SummaryCards.jsx
import React from 'react';
import { Users, CheckCircle, XCircle, TriangleAlert } from 'lucide-react';

const SummaryCards = ({
  totalLeads,
  successCount,
  rejectCount,
  duplicateCount,
  loading,
  in_progress,
  showInProgress = false,
  duplicateCard = false,
  errorsCount = 0,
  errorCard = false,
  // When provided, cards become clickable and call onCardClick(cardKey).
  // The parent maps the semantic key to its own status filter value.
  onCardClick,
  activeKey,
}) => {
  const cards = [
    {
      show: typeof totalLeads === 'number',
      key: 'total',
      title: 'Total Leads',
      value: totalLeads,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      show: typeof successCount === 'number',
      key: 'success',
      title: 'Successful',
      value: successCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      show: typeof rejectCount === 'number',
      key: 'reject',
      title: 'Rejected',
      value: rejectCount,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      show: duplicateCard && typeof duplicateCount === 'number',
      key: 'duplicate',
      title: 'Duplicate (Error)',
      value: duplicateCount,
      icon: TriangleAlert,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      show: errorCard && typeof errorsCount === 'number',
      key: 'error',
      title: 'Errors',
      value: errorsCount,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      show: showInProgress && typeof in_progress === 'number',
      key: 'in_progress',
      title: 'In Progress',
      value: in_progress,
      icon: TriangleAlert,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
  ].filter(card => card.show);

  // Skeleton uses the shared animate-shimmer keyframe (defined in
  // tailwind.config.js). Two staggered bars — title-width + value-width —
  // with a sweeping indigo→purple gradient so the cards feel actively
  // loading instead of statically faded.
  const SkeletonCard = () => (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="h-4 w-1/2 rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer mb-3" />
      <div className="h-8 w-3/4 rounded-md bg-gradient-to-r from-indigo-100 via-purple-200 to-indigo-100 bg-[length:200%_100%] animate-shimmer" />
    </div>
  );

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-5 gap-4 mb-4`}>
      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        cards.map((card) => {
          const clickable = typeof onCardClick === 'function';
          const isActive = clickable && activeKey === card.key;
          return (
            <div
              key={card.title}
              onClick={clickable ? () => onCardClick(card.key) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onCardClick(card.key);
                      }
                    }
                  : undefined
              }
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              title={clickable ? `Filter by ${card.title}` : undefined}
              className={`flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border transition duration-300 hover:shadow-md ${
                clickable ? 'cursor-pointer hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-300' : ''
              } ${
                isActive ? 'border-purple-500 ring-2 ring-purple-200 shadow-md' : 'border-gray-200'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : 'N/A'}
                </p>
              </div>
              <div className={`p-3 rounded-full ${card.bg}`}>
                <card.icon className={`${card.color}`} size={24} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default SummaryCards;