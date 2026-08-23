import { useState } from "react";
import { Star, Send } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

const FeedbackForm = ({ complaintId, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return toast.error("Please select a star rating");

    setIsSubmitting(true);
    try {
      await api.post("/feedback", { complaintId, rating, comments });
      toast.success("Thank you for your feedback!");
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg p-6 border border-gray-200 mt-4"
    >
      <h4 className="font-bold text-gray-900 mb-4">How was your experience?</h4>

      <div className="flex items-center space-x-2 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`transition-colors ${star <= (hover || rating) ? "text-yellow-400" : "text-gray-300"}`}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            <Star className="w-8 h-8 fill-current" />
          </button>
        ))}
      </div>

      <textarea
        placeholder="Any additional comments? (Optional)"
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none mb-4 text-gray-900 bg-white placeholder-gray-500"
        rows="3"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      ></textarea>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 transition-all"
      >
        {isSubmitting ? (
          "Submitting..."
        ) : (
          <>
            {" "}
            <Send className="w-4 h-4 mr-2" /> Submit Review{" "}
          </>
        )}
      </button>
    </form>
  );
};

export default FeedbackForm;
