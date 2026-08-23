import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

const Unauthorized = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-100">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">
        Access Restricted
      </h1>
      <p className="text-gray-500 mb-8 max-w-md">
        Sorry, you don't have the required administrative permissions to access
        this specific module.
      </p>
      <Link
        to="/dashboard"
        className="text-primary font-bold hover:underline flex items-center"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Link>
    </div>
  );
};

export default Unauthorized;
