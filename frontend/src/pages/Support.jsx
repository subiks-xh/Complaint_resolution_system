import { HelpCircle, Mail, Phone, MessageSquare } from "lucide-react";

const Support = () => {
  const faqs = [
    {
      question: "How do I submit a complaint?",
      answer: "After logging in, navigate to 'Submit Complaint' and fill out the form with details about your issue. You can also attach supporting documents."
    },
    {
      question: "How can I track my complaint status?",
      answer: "Go to 'My Complaints' in your dashboard to view all submitted complaints with their current status and timeline."
    },
    {
      question: "What are the different complaint statuses?",
      answer: "Complaints can be: New, Assigned, In Progress, Resolved, Closed, or Escalated. Each status represents a different stage in the resolution process."
    },
    {
      question: "How do I reset my password?",
      answer: "Click 'Forgot Password' on the login page, enter your email, and follow the instructions sent to your email."
    },
    {
      question: "Can I cancel a complaint?",
      answer: "Yes, you can cancel a complaint that is still in 'New' or 'Assigned' status by clicking the Cancel button on the complaint details page."
    },
    {
      question: "How do I provide feedback on a resolved complaint?",
      answer: "Once a complaint is resolved, you'll receive a notification. You can then provide a rating and feedback on the resolution."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Support & Help
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            We're here to help you get the most out of CRS Portal
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 text-center">
            <Mail className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Email Us</h3>
            <p className="text-gray-600 dark:text-gray-400">support@crsportal.com</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 text-center">
            <Phone className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Call Us</h3>
            <p className="text-gray-600 dark:text-gray-400">+1 (555) 000-0000</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 text-center">
            <MessageSquare className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Chat</h3>
            <p className="text-gray-600 dark:text-gray-400">Live chat available 24/7</p>
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
            <HelpCircle className="h-8 w-8 mr-3 text-primary" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <details
                key={idx}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 cursor-pointer group"
              >
                <summary className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                  {faq.question}
                  <span className="ml-4 text-primary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-gray-600 dark:text-gray-400 mt-4 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* Additional Help */}
        <div className="mt-16 bg-primary/10 dark:bg-primary/20 p-8 rounded-lg border border-primary/20 dark:border-primary/30">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Didn't find what you're looking for?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Our support team is ready to assist you. Reach out through any of the contact methods above,
            and we'll get back to you as soon as possible.
          </p>
          <a
            href="mailto:support@crsportal.com"
            className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default Support;
