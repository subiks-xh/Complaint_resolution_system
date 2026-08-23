import { Shield, Users, Zap, Globe } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            About CRS Portal
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Revolutionizing complaint resolution with enterprise-grade technology
          </p>
        </div>

        {/* Mission Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Our Mission
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The Complaint Resolution System (CRS) Portal is designed to streamline and
            automate the process of managing, tracking, and resolving complaints for
            organizations of all sizes. We believe that every complaint is an opportunity
            to improve service quality and customer satisfaction.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Our platform empowers organizations to respond quickly, efficiently, and
            professionally to complaints, ensuring no issue goes unaddressed.
          </p>
        </div>

        {/* Key Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            Why Choose CRS Portal?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Experience instant complaint processing and real-time updates"
              },
              {
                icon: Users,
                title: "Team Collaboration",
                description: "Seamless coordination between staff members and departments"
              },
              {
                icon: Globe,
                title: "Multi-Organization",
                description: "Manage multiple organizations from a single platform"
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "Bank-level encryption and compliance with industry standards"
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Technology Stack */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Built with Modern Technology
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Frontend</h4>
              <p className="text-gray-600 dark:text-gray-400">React, Tailwind CSS, Vite</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Backend</h4>
              <p className="text-gray-600 dark:text-gray-400">Node.js, Express, MongoDB</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Security</h4>
              <p className="text-gray-600 dark:text-gray-400">JWT, HTTPS, Rate Limiting</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
