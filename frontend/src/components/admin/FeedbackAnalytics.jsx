import { useState, useEffect } from "react";
import { Star, ThumbsUp, ThumbsDown, MessageSquareQuote } from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";

const FeedbackAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedbackStats = async () => {
      try {
        const { data } = await api.get("/feedback/stats");
        setData(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedbackStats();
  }, []);

  if (loading) return <Loader text="Analyzing user sentiment..." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          User Satisfaction Analysis
        </h1>
        <p className="text-gray-500">
          Aggregated feedback and ratings from resolved tickets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rating Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6">Rating Distribution</h3>
          <div className="space-y-4">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center space-x-4">
                <span className="text-sm font-bold text-gray-600 flex items-center w-6">
                  {star} <Star className="w-3 h-3 ml-0.5 fill-current" />
                </span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400"
                    style={{
                      width: `${(data?.ratingDistribution?.[star] / data?.overview?.totalFeedbacks) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-400 w-8">
                  {data?.ratingDistribution?.[star] || 0}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center pt-6 border-t border-gray-50">
            <p className="text-4xl font-black text-gray-900">
              {data?.overview?.averageRating || 0}
            </p>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
              Average Score
            </p>
          </div>
        </div>

        {/* Staff Rankings */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center">
            <ThumbsUp className="w-5 h-5 mr-2 text-green-500" /> Top Performing
            Staff
          </h3>
          <div className="overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                  <th className="pb-4">Name</th>
                  <th className="pb-4">Dept.</th>
                  <th className="pb-4">Avg. Rating</th>
                  <th className="pb-4">Resolutions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.staffRankings?.map((staff, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-4 font-bold text-gray-900">
                      {staff.name}
                    </td>
                    <td className="py-4 text-gray-500">{staff.department}</td>
                    <td className="py-4 font-bold text-yellow-500 flex items-center">
                      {staff.avgRating}{" "}
                      <Star className="w-3 h-3 ml-1 fill-current" />
                    </td>
                    <td className="py-4 text-gray-700 font-medium">
                      {staff.totalFeedbacks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackAnalytics;
