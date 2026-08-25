import React, { useState, useEffect, useCallback } from "react";
import { X, ShieldCheck, FileDown, Filter, Loader2 } from "lucide-react";
import OtpVerification from "./OtpVerification";

// Export is OTP-gated, and always exports the CURRENT filtered view of the table
// the user is looking at — the date range and every other filter come from the
// page's own filter bar, NOT from this modal. Re-asking for a date here only ever
// let the export disagree with what the user had on screen, so it was removed:
// the modal now collects the OTP and nothing else.
//
// `isSubmitting` drives a dedicated "Export in progress" view (spinner + message +
// indeterminate bar). For that to be meaningful the parent must keep isSubmitting
// TRUE for the whole export — i.e. await a fetch()+blob download, not fire-and-
// forget an <a download> link (which resolves instantly). Large exports run for a
// minute or two, so this view reassures the user it's working and blocks closing.
const ExportModal = ({ open, onClose, onSubmit, isSubmitting = false }) => {
  const [otpData, setOtpData] = useState({
    otp: "",
    hashedOtp: "",
    mobileNumber: "",
    otpSent: false,
  });

  useEffect(() => {
    if (open) {
      setOtpData({ otp: "", hashedOtp: "", mobileNumber: "", otpSent: false });
    }
  }, [open]);

  const handleOtpChange = useCallback((data) => {
    setOtpData(data);
  }, []);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    // Date + filters are the page's job now — the modal only proves identity.
    onSubmit({ otp: otpData.otp, hashedOtp: otpData.hashedOtp });
  };

  // Don't let a stray backdrop / X click abandon an in-flight export.
  const requestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <style>{`@keyframes exp-indet {0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}`}</style>
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-in-out">
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <FileDown className="text-blue-600" />
            Export Data
          </h2>
          <button
            onClick={requestClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={24} />
          </button>
        </div>

        {isSubmitting ? (
          /* ── Export-in-progress ─────────────────────────────────────── */
          <div className="py-6 flex flex-col items-center text-center gap-5">
            <div className="relative w-16 h-16 grid place-items-center">
              <span className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-60" />
              <span className="absolute inset-1 rounded-full bg-blue-50" />
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white shadow-lg shadow-blue-500/30">
                <Loader2 size={26} className="animate-spin" />
              </div>
            </div>

            <div>
              <p className="text-lg font-bold text-gray-800">Export in progress…</p>
              <p className="text-[13px] text-gray-500 mt-1.5 max-w-[320px] leading-relaxed">
                Preparing your CSV from the current filtered view. Large date
                ranges can take a minute or two — please keep this window open.
              </p>
            </div>

            {/* Indeterminate progress bar */}
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                style={{ animation: "exp-indet 1.2s ease-in-out infinite" }}
              />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Fetching · Building CSV · Downloading
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <OtpVerification onChange={handleOtpChange} resetSignal={open} />

            {otpData.otpSent && (
              <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                <Filter size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[12.5px] text-gray-600 leading-relaxed">
                  Export will use the filters currently applied to the table
                  (date range, search, and every other filter) — exactly the view
                  you see on screen.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={requestClose}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              {otpData.otpSent && (
                <button
                  type="submit"
                  disabled={!otpData.otp}
                  className="px-6 py-2 text-sm font-semibold rounded-lg shadow-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  <ShieldCheck size={18} />
                  Verify & Export
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ExportModal;
