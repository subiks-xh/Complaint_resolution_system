import { useEffect, useState } from "react";
import {
  CreditCard,
  FileText,
  RefreshCw,
  ShieldAlert,
  Search,
  Undo2,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-hot-toast";
import { useLocation } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Loader from "../common/Loader";

const statusStyles = {
  initiated: "bg-yellow-50 text-yellow-700 border-yellow-100",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-100",
  paid: "bg-green-50 text-green-700 border-green-100",
  failed: "bg-red-50 text-red-700 border-red-100",
  refunded: "bg-gray-100 text-gray-700 border-gray-200",
};

const PaymentCenter = () => {
  const { user } = useAuth();
  const isAdmin = ["admin", "org_admin", "super_admin"].includes(user?.role);
  const location = useLocation();

  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentLookupId, setPaymentLookupId] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [autoCompleteDemo, setAutoCompleteDemo] = useState(true);
  const [payingWithRazorpay, setPayingWithRazorpay] = useState(false);
  const [initForm, setInitForm] = useState({
    complaintId: "",
    method: "demo",
    purpose: "premium_escalation",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const paymentsEndpoint = isAdmin
        ? "/payments/my-payments?limit=25&scope=organization"
        : "/payments/my-payments?limit=25";
      const promises = [api.get(paymentsEndpoint)];

      if (isAdmin) {
        promises.push(api.get("/payments/admin/summary"));
      }

      const responses = await Promise.all(promises);
      const paymentsResponse = responses[0];

      setPayments(paymentsResponse.data.data || []);

      if (isAdmin) {
        setSummary(responses[1].data.data);
      }
    } catch (error) {
      console.error("Failed to load payment data:", error);
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const complaintIdFromQuery = params.get("complaintId");

    if (complaintIdFromQuery) {
      setInitForm((prev) => ({ ...prev, complaintId: complaintIdFromQuery }));
    }
  }, [location.search]);

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const initiatePayment = async (event) => {
    event.preventDefault();
    if (!initForm.complaintId.trim()) {
      toast.error("Complaint ID is required");
      return;
    }

    setInitiating(true);
    try {
      const { data } = await api.post(
        `/payments/complaints/${initForm.complaintId}/initiate`,
        {
          method: initForm.method,
          purpose: initForm.purpose,
          notes: initForm.notes,
        },
      );

      const newPaymentId = data?.data?.paymentId;
      const shouldAutoConfirm =
        autoCompleteDemo && initForm.method === "demo" && newPaymentId;

      if (shouldAutoConfirm) {
        await api.post(`/payments/${newPaymentId}/confirm`, {
          gatewayPaymentId: `DEMO-${Date.now()}`,
          markAsPaid: true,
        });
        toast.success("Demo payment completed successfully");
      } else {
        toast.success("Payment initiated");
      }

      setInitForm({
        complaintId: "",
        method: "demo",
        purpose: "premium_escalation",
        notes: "",
      });
      await loadData();
    } catch (error) {
      console.error("Initiate payment error:", error);
      toast.error(
        error.response?.data?.message || "Failed to initiate payment",
      );
    } finally {
      setInitiating(false);
    }
  };

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const payWithRazorpayDemo = async () => {
    if (!initForm.complaintId.trim()) {
      toast.error("Complaint ID is required");
      return;
    }

    setPayingWithRazorpay(true);
    try {
      const { data } = await api.post(
        `/payments/complaints/${initForm.complaintId}/initiate`,
        {
          method: "card",
          purpose: initForm.purpose,
          notes: initForm.notes || "Razorpay test-mode demo payment",
        },
      );

      const paymentId = data?.data?.paymentId;
      const amountPaise = data?.data?.checkout?.amountPaise;
      const currency = data?.data?.currency || "INR";

      if (!paymentId || !amountPaise) {
        throw new Error("Invalid payment initialization response");
      }

      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded || !window.Razorpay) {
        toast.error("Razorpay SDK failed to load. Check internet connection.");
        await api.post(`/payments/${paymentId}/confirm`, { markAsPaid: false });
        return;
      }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || "";
      if (!razorpayKey) {
        toast.error(
          "Set VITE_RAZORPAY_KEY_ID in frontend .env for Razorpay test mode",
        );
        await api.post(`/payments/${paymentId}/confirm`, { markAsPaid: false });
        return;
      }

      const options = {
        key: razorpayKey,
        amount: amountPaise,
        currency,
        name: "Complaint Resolution System",
        description: "Test payment for complaint priority handling",
        handler: async (response) => {
          await api.post(`/payments/${paymentId}/confirm`, {
            gatewayPaymentId:
              response?.razorpay_payment_id || `RZP-DEMO-${Date.now()}`,
            markAsPaid: true,
          });
          toast.success("Razorpay test payment completed");
          await loadData();
        },
        modal: {
          ondismiss: async () => {
            try {
              await api.post(`/payments/${paymentId}/confirm`, {
                markAsPaid: false,
              });
            } catch (error) {
              console.error("Razorpay dismiss mark failed error:", error);
            }
          },
        },
        prefill: {
          name: user?.name || "Demo User",
          email: user?.email || "demo@example.com",
        },
        theme: {
          color: "#2563eb",
        },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    } catch (error) {
      console.error("Razorpay demo payment error:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to start Razorpay test payment",
      );
    } finally {
      setPayingWithRazorpay(false);
    }
  };

  const confirmPayment = async (paymentId) => {
    try {
      await api.post(`/payments/${paymentId}/confirm`, {
        gatewayPaymentId: `DEMO-${Date.now()}`,
        markAsPaid: true,
      });
      toast.success("Payment confirmed");
      await loadData();
    } catch (error) {
      console.error("Confirm payment error:", error);
      toast.error(error.response?.data?.message || "Failed to confirm payment");
    }
  };

  const openReceipt = async (paymentId) => {
    try {
      const { data } = await api.get(`/payments/${paymentId}/receipt`);
      setReceipt(data.data);
      setShowReceipt(true);
    } catch (error) {
      console.error("Receipt error:", error);
      toast.error(error.response?.data?.message || "Failed to load receipt");
    }
  };

  const refundPayment = async (paymentId) => {
    const reason =
      refundReason.trim() ||
      window.prompt("Refund reason", "Demo refund") ||
      "";
    if (!reason) {
      return;
    }

    try {
      await api.post(`/payments/${paymentId}/refund`, { reason });
      toast.success("Payment refunded");
      setRefundReason("");
      await loadData();
    } catch (error) {
      console.error("Refund error:", error);
      toast.error(error.response?.data?.message || "Failed to refund payment");
    }
  };

  const lookupReceipt = async () => {
    if (!paymentLookupId.trim()) {
      toast.error("Enter a payment ID first");
      return;
    }

    await openReceipt(paymentLookupId.trim());
  };

  if (loading) {
    return <Loader fullScreen text="Loading payments..." />;
  }

  const totalAmount = payments.reduce(
    (sum, payment) => sum + (payment.amount || 0),
    0,
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-blue-100 text-sm font-medium">Payments</p>
            <h1 className="text-3xl font-bold mt-1">Payment Center</h1>
            <p className="text-blue-100 mt-2 max-w-2xl">
              Track complaint-linked payments and receipts. Admins can also
              confirm and refund transactions.
            </p>
            <p className="text-blue-200 mt-2 text-sm">
              Access role:{" "}
              <span className="font-semibold capitalize">
                {user?.role || "unknown"}
              </span>
            </p>
          </div>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/20 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">My payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {payments.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Total amount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${totalAmount.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Current role</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 capitalize">
            {user?.role || "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Initiate a Payment
              </h2>
              <p className="text-sm text-gray-500">
                Create a demo payment using complaint ObjectId or complaintId.
              </p>
            </div>
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>

          <form onSubmit={initiatePayment} className="grid gap-4">
            <input
              value={initForm.complaintId}
              onChange={(event) =>
                setInitForm((prev) => ({
                  ...prev,
                  complaintId: event.target.value,
                }))
              }
              placeholder="Complaint ObjectId"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={initForm.method}
                onChange={(event) =>
                  setInitForm((prev) => ({
                    ...prev,
                    method: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="demo" className="text-gray-900 bg-white">
                  Demo
                </option>
                <option value="card" className="text-gray-900 bg-white">
                  Card
                </option>
                <option value="upi" className="text-gray-900 bg-white">
                  UPI
                </option>
                <option value="netbanking" className="text-gray-900 bg-white">
                  Net Banking
                </option>
              </select>
              <select
                value={initForm.purpose}
                onChange={(event) =>
                  setInitForm((prev) => ({
                    ...prev,
                    purpose: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option
                  value="premium_escalation"
                  className="text-gray-900 bg-white"
                >
                  Premium Escalation
                </option>
                <option value="service_fee" className="text-gray-900 bg-white">
                  Service Fee
                </option>
                <option
                  value="verification_fee"
                  className="text-gray-900 bg-white"
                >
                  Verification Fee
                </option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoCompleteDemo}
                onChange={(event) => setAutoCompleteDemo(event.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-complete demo payment instantly
            </label>
            <textarea
              rows="3"
              value={initForm.notes}
              onChange={(event) =>
                setInitForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Optional notes"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={initiating}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initiating ? "Initiating..." : "Initiate Payment"}</span>
            </button>
            <button
              type="button"
              onClick={payWithRazorpayDemo}
              disabled={payingWithRazorpay}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {payingWithRazorpay
                  ? "Opening Razorpay..."
                  : "Pay with Razorpay (Test)"}
              </span>
            </button>
          </form>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Receipt Lookup
              </h2>
              <p className="text-sm text-gray-500">
                Open a payment receipt by ID.
              </p>
            </div>
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>

          <div className="grid gap-3">
            <input
              value={paymentLookupId}
              onChange={(event) => setPaymentLookupId(event.target.value)}
              placeholder="Payment ID"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={lookupReceipt}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              >
                <Search className="w-4 h-4" />
                Open Receipt
              </button>
              {isAdmin && (
                <button
                  onClick={() => refundPayment(paymentLookupId.trim())}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700"
                >
                  <Undo2 className="w-4 h-4" />
                  Refund
                </button>
              )}
            </div>
            {isAdmin && (
              <textarea
                rows="2"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="Refund reason (optional)"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            )}
          </div>
        </div>
      </div>

      {isAdmin && summary && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Admin Summary</h2>
              <p className="text-sm text-gray-500">
                Backend payment aggregates.
              </p>
            </div>
            <ShieldAlert className="w-5 h-5 text-orange-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">By Status</h3>
              <div className="space-y-2 text-sm text-gray-600">
                {summary.byStatus?.length ? (
                  summary.byStatus.map((item) => (
                    <div key={item._id} className="flex justify-between">
                      <span className="capitalize">
                        {item._id || "unknown"}
                      </span>
                      <span>
                        {item.count} / ${item.totalAmount || 0}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No payment status data yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">By Method</h3>
              <div className="space-y-2 text-sm text-gray-600">
                {summary.byMethod?.length ? (
                  summary.byMethod.map((item) => (
                    <div key={item._id} className="flex justify-between">
                      <span className="capitalize">
                        {item._id || "unknown"}
                      </span>
                      <span>
                        {item.count} / ${item.totalAmount || 0}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No payment method data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
            <p className="text-sm text-gray-500">
              Your latest complaint-linked transactions.
            </p>
          </div>
          <CreditCard className="w-5 h-5 text-gray-400" />
        </div>

        {payments.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No payments found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payments.map((payment) => (
              <div
                key={payment._id}
                className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {payment.paymentRef}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full border uppercase ${statusStyles[payment.status] || "bg-gray-50 text-gray-700 border-gray-100"}`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Complaint: {payment.complaint?.complaintId || "N/A"} •{" "}
                    {payment.purpose} • {payment.method}
                  </p>
                  <p className="text-sm text-gray-500">
                    Amount: ${payment.amount} •{" "}
                    {formatDistanceToNow(new Date(payment.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                  {isAdmin && payment.paidBy?.name && (
                    <p className="text-sm text-gray-500">
                      Payer: {payment.paidBy.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openReceipt(payment._id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Receipt
                  </button>
                  {payment.status !== "paid" && (
                    <button
                      onClick={() => confirmPayment(payment._id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Demo
                    </button>
                  )}
                  {isAdmin && payment.status === "paid" && (
                    <button
                      onClick={() => refundPayment(payment._id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
                    >
                      <Undo2 className="w-4 h-4" />
                      Refund
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReceipt && receipt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Payment Receipt
                </h3>
                <p className="text-sm text-gray-500">
                  Receipt {receipt.receiptNo}
                </p>
              </div>
              <button
                onClick={() => setShowReceipt(false)}
                className="text-gray-500 hover:text-gray-800 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-gray-500">Complaint</p>
                <p className="font-semibold text-gray-900">
                  {receipt.complaint?.complaintId}
                </p>
                <p className="text-gray-600">{receipt.complaint?.title}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-gray-500">Paid By</p>
                <p className="font-semibold text-gray-900">
                  {receipt.paidBy?.name}
                </p>
                <p className="text-gray-600">{receipt.paidBy?.email}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-gray-500">Amount</p>
                <p className="font-semibold text-gray-900">${receipt.amount}</p>
                <p className="text-gray-600 capitalize">{receipt.method}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-gray-500">Status</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {receipt.status}
                </p>
                <p className="text-gray-600">
                  {receipt.paidAt
                    ? new Date(receipt.paidAt).toLocaleString()
                    : new Date(receipt.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCenter;
