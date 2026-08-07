import React, { useState, useEffect, useCallback } from "react";
import { X, ShieldCheck, FileDown, Filter } from "lucide-react";
import OtpVerification from "./OtpVerification";

// Export is OTP-gated, and always exports the CURRENT filtered view of the table
// the user is looking at — the date range and every other filter come from the
// page's own filter bar, NOT from this modal. Re-asking for a date here only ever
// let the export disagree with what the user had on screen, so it was removed:
// the modal now collects the OTP and nothing else.
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-in-out">
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <FileDown className="text-blue-600" />
            Export Data
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

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
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            {otpData.otpSent && (
              <button
                type="submit"
                disabled={isSubmitting || !otpData.otp}
                className="px-6 py-2 text-sm font-semibold rounded-lg shadow-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <ShieldCheck size={18} />
                {isSubmitting ? "Verifying..." : "Verify & Export"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportModal;
