import { Link } from "react-router-dom";
import { Home, Compass } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <Compass className="w-20 h-20 text-gray-200 mb-6" />
      <h1 className="text-6xl font-black text-gray-900 mb-2 tracking-tighter">
        404
      </h1>
      <p className="text-xl font-bold text-gray-500 mb-8">Page Not Found</p>
      <p className="text-gray-400 text-center max-w-md mb-8">
        The page you are looking for might have been removed, had its name
        changed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
      >
        <Home className="w-5 h-5 mr-2" /> Return Home
      </Link>
    </div>
  );
};

export default NotFound;
