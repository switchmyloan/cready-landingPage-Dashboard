
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const VyaparKBLendingPageDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lead } = location.state || {};
  const [activeTab, setActiveTab] = useState("Basic");

  const tabs = ["Basic", "Lender Response"];

  if (!lead) {
    return (
      <div className="p-10 border border-red-300 bg-red-50 rounded-lg">
        <h1 className="text-2xl font-bold text-red-800 mb-2">Data Loading Error!</h1>
        <p className="text-red-700">Lead data could not be found. Please go back and select a lead.</p>
        <button onClick={() => navigate(-1)} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">Go Back</button>
      </div>
    );
  }

  const lenderResponse = lead?.lender_response;
  const kbResponse = lenderResponse?.KreditBee || lenderResponse;

  return (
    <div className="w-full">
      <div className="rounded-lg shadow-sm px-4">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-2 text-sm font-medium transition-colors ${activeTab === tab ? "text-indigo-600" : "text-gray-600 hover:text-indigo-600"}`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute left-0 -bottom-[1px] h-0.5 w-full bg-indigo-600 rounded"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 rounded-lg shadow-sm bg-white">
        {activeTab === "Basic" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-12">
              <div>
                <p className="text-sm font-medium text-gray-700">Name:</p>
                <p className="text-gray-700 font-medium">{lead.firstName + ' ' + lead.lastName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone:</p>
                <p className="text-gray-700 font-medium">{lead.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email:</p>
                <p className="text-gray-700 font-medium">{lead.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Gender:</p>
                <p className="text-gray-700 font-medium">{lead.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Date of Birth:</p>
                <p className="text-gray-700 font-medium">{lead.dob || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">PAN Number:</p>
                <p className="text-gray-700 font-medium">{lead.panNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Pincode:</p>
                <p className="text-gray-700 font-medium">{lead.pincode || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Profession:</p>
                <p className="text-gray-700 font-medium">{lead.profession || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Salary:</p>
                <p className="text-gray-700 font-medium">{lead.salary ? `₹ ${Number(lead.salary).toLocaleString('en-IN')}` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Loan Amount:</p>
                <p className="text-gray-700 font-medium">{lead.loanAmount ? `₹ ${Number(lead.loanAmount).toLocaleString('en-IN')}` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Message:</p>
                <p className="text-gray-700 font-medium">{lead.message || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created At:</p>
                <p className="text-gray-700 font-medium">{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Lender Response" && (
          <div>
            {kbResponse ? (
              <div className="space-y-4">
                <div className={`p-6 border rounded-xl shadow-sm ${kbResponse.success ? 'border-green-200' : 'border-red-200'}`}>
                  <div className={`px-5 py-3 rounded-t-xl flex items-center justify-between ${kbResponse.success ? 'bg-green-50' : 'bg-red-50'}`}>
                    <h3 className="text-base font-bold text-gray-800">KreditBee Response</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${kbResponse.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {kbResponse.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Message</p>
                      <p className="text-sm text-gray-800">{kbResponse.message || 'N/A'}</p>
                    </div>
                    {kbResponse.statusCode && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Status Code</p>
                        <p className="text-sm text-gray-800">{kbResponse.statusCode}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Raw Response</h3>
                  <div className="bg-gray-800 text-white p-4 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="text-xs">{JSON.stringify(lenderResponse, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-lg font-medium text-gray-500">No lender response data available.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VyaparKBLendingPageDetail;
