import { Link } from "react-router-dom";
import { Shield, CheckCircle, Clock, Zap, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const Home = () => {
  const { user } = useAuth();

  const features = [
    {
      title: "Transparent Tracking",
      desc: "Monitor the exact status of your complaint in real-time.",
      icon: Zap,
    },
    {
      title: "Smart Escalation",
      desc: "Automatic routing to senior staff if deadlines are breached.",
      icon: Clock,
    },
    {
      title: "Role-Based Access",
      desc: "Secure portals for users, staff, and administrators.",
      icon: Shield,
    },
    {
      title: "Resolution Quality",
      desc: "Built-in feedback system to ensure high-quality support.",
      icon: CheckCircle,
    },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-sm font-bold mb-6 border border-blue-100">
              <Shield className="w-4 h-4" />
              <span>Enterprise Resolution Engine</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
              Resolution at the{" "}
              <span className="text-primary">Speed of Light.</span>
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
              Our automated system ensures that every concern is heard, tracked,
              and resolved within guaranteed timelines.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="px-8 py-4 bg-primary text-white rounded-xl font-bold hover:bg-blue-600 transition-all flex items-center shadow-lg shadow-blue-200"
                >
                  Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
                  >
                    Get Started
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Member Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center mb-6">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
