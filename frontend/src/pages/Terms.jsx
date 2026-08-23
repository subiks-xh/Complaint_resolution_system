const Terms = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Terms of Service
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-100 dark:border-gray-700 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              1. Agreement to Terms
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              By accessing and using the Complaint Resolution System Portal website and services
              (collectively, the "Site"), you accept and agree to be bound by and comply with the terms
              and provision of this agreement. If you do not agree to abide by the above, please do
              not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              2. Use License
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Permission is granted to temporarily download one copy of the materials (information or
              software) on the Complaint Resolution System Portal website for personal, non-commercial
              transitory viewing only. This is the grant of a license, not a transfer of title, and
              under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 mt-3">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to decompile or reverse engineer any software contained on the Site</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              3. Disclaimer
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              The materials on the Complaint Resolution System Portal website are provided on an 'as is' basis.
              The Site makes no warranties, expressed or implied, and hereby disclaims and negates all other
              warranties including, without limitation, implied warranties or conditions of merchantability,
              fitness for a particular purpose, or non-infringement of intellectual property or other
              violation of rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              4. Limitations
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              In no event shall the Complaint Resolution System Portal or its suppliers be liable for any
              damages (including, without limitation, damages for loss of data or profit, or due to business
              interruption) arising out of the use or inability to use the materials on the Site, even if
              we or our authorized representative has been notified orally or in writing of the possibility
              of such damage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              5. User Conduct
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              You agree to use this Site in a lawful manner and not to use it:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 mt-3">
              <li>For fraudulent or deceptive purposes</li>
              <li>To violate any applicable laws, rules, or regulations</li>
              <li>To infringe upon any intellectual property rights</li>
              <li>To transmit any harmful or malicious code</li>
              <li>To harass, abuse, or harm any person</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              6. Termination
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We may terminate or suspend your access to and use of the Site and any services, in our sole
              discretion, without notice, for any conduct that we, in our sole discretion, believe is in
              violation of any applicable law or is harmful to the interests of the Site, its users, or the
              public.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              7. Modifications
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              The Complaint Resolution System Portal may revise these terms of service for the Site at any
              time without notice. By using this Site, you are agreeing to be bound by the then current
              version of these terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              8. Governing Law
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              The materials appearing on the Complaint Resolution System Portal website could include
              technical, typographical, or photographic errors. These terms and conditions are governed by
              and construed in accordance with the laws of the jurisdiction where the Site operator is
              located, and you irrevocably submit to the exclusive jurisdiction of the courts in that
              location.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              9. Contact Information
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 text-gray-600 dark:text-gray-400">
              <p>Email: support@crsportal.com</p>
              <p>Phone: +1 (555) 000-0000</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
