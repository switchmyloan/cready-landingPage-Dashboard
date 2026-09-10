
// Premium first-load page-level loader. Same visual language as the
// /disbursal-dashboard and /offer-leads loaders, but parameterized so each
// page just supplies its own theme + title + phrases + tiles instead of
// duplicating ~200 lines of JSX per file.
//
// Usage:
//   <PremiumPageLoader
//     theme="sky"
//     title="Loading Short Offer Leads"
//     brandLabel="Live Short Offer Leads"
//     phrases={['...', '...']}
//     tiles={[{ label: 'Total' }, { label: 'Lenders' }, { label: 'Today' }]}
//     progressLabel="Preparing your leads"
//   />
//
// Themes — predefined Tailwind color triplets that get inlined into the
// gradient classes. Add more here if a new section needs its own palette.
/* A quiet skeleton of the page that is coming, not a splash screen.
 *
 * What this replaced: a full-viewport branded card — haloed icon with a ₹ badge, a
 * brand pill, a 28px title, rotating status phrases, three empty stat tiles, a
 * "SECURE · ENCRYPTED" line, animated dots, and a progress bar that eased toward
 * 95%. That bar was the worst of it: it was pure animation, tied to nothing, so it
 * could read 76% on a request that had barely started, or sit near 95% for half a
 * minute. A progress number that cannot be trusted is worse than none.
 *
 * A skeleton instead shows WHERE things will land, so the swap to real content is
 * not a jump-cut. The props are kept so the nine pages using this need no edits —
 * `tiles` still decides how many placeholder cards to draw.
 */
const PremiumPageLoader = ({
    title = 'Loading…',
    tiles = [{ label: 'Total' }, { label: 'Today' }, { label: 'Active' }],
    // theme / brandLabel / icon / phrases / progressLabel are accepted and ignored:
    // callers still pass them, and dropping them from every page is churn for no
    // gain. Kept out of the render so nothing animates for animation's sake.
}) => {
    const bar = 'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer';
    return (
        <div className="max-w-[1440px] mx-auto px-2 py-4" aria-busy="true" aria-live="polite">
            {/* Header line */}
            <div className="flex items-center gap-2.5 mb-4">
                <span className={`w-9 h-9 rounded-xl ${bar}`} />
                <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-gray-400">{title}</div>
                    <div className={`h-2.5 w-52 rounded mt-1.5 ${bar}`} />
                </div>
            </div>

            {/* Filter strip */}
            <div className={`h-10 rounded-xl mb-4 ${bar}`} />

            {/* One card per tile the page is about to show. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-4">
                {tiles.map((tile, i) => (
                    <div key={tile?.label || i} className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className={`h-2.5 w-20 rounded ${bar}`} />
                            <div className={`w-7 h-7 rounded-lg ${bar}`} />
                        </div>
                        <div className={`h-6 w-24 rounded mt-3 ${bar}`} />
                        <div className={`h-2 w-16 rounded mt-3 ${bar}`} />
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className={`h-9 ${bar}`} />
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-t border-gray-50">
                        {[120, 90, 150, 70, 110].map((w, j) => (
                            <div key={j} className={`h-2.5 rounded ${bar}`} style={{ width: w }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PremiumPageLoader;
