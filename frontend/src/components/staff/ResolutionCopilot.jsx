import { Lightbulb, Sparkles, Wand2, CheckCircle2, Clock3, ThumbsUp } from "lucide-react";

const getNextBestAction = (complaint) => {
  if (!complaint) return "Review the issue and confirm the customer's priority.";

  if (complaint.status === "assigned") {
    return "Start work and capture the first response before the SLA window tightens.";
  }

  if (complaint.status === "in-progress") {
    return "Focus on the most recent similar resolved cases and keep notes updated.";
  }

  if (complaint.status === "escalated") {
    return "Escalation is active. Resolve the blocking step first, then update the user.";
  }

  return "Document the fix clearly and close the loop with the complainant.";
};

const getPriorityCue = (priority) => {
  switch (priority) {
    case "critical":
      return "Critical priority needs immediate response and frequent progress updates.";
    case "high":
      return "High priority should be handled today and tracked for SLA risk.";
    case "medium":
      return "Medium priority can follow the normal queue, but keep visibility high.";
    default:
      return "Low priority can be resolved with standard workflow and clear closure notes.";
  }
};

const ResolutionCopilot = ({ complaint }) => {
  const similarResolved = complaint?.similarResolved || [];
  const actions = complaint?.actions || {};

  return (
    <aside className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-5 sticky top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-3">
            <Wand2 className="w-3.5 h-3.5" /> Resolution Copilot
          </div>
          <h3 className="text-lg font-bold text-gray-900">Smart case memory</h3>
          <p className="text-sm text-gray-500 mt-1">
            Similar solved cases and next-step guidance for faster resolution.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
          <Sparkles className="w-5 h-5" />
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-2">
          <Lightbulb className="w-4 h-4" />
          Recommended next action
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {getNextBestAction(complaint)}
        </p>
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
          <Clock3 className="w-4 h-4 text-amber-500" /> Priority cue
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {getPriorityCue(complaint?.priority)}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-900">Suggested actions</div>
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
            {actions.canAddEvidence ? "Active" : "Limited"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm">
          {actions.canStartWork !== false && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Start the work timer and document progress.
            </div>
          )}
          {actions.canAddNotes !== false && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-gray-700">
              <ThumbsUp className="w-4 h-4 text-blue-500" />
              Add internal notes to preserve resolution context.
            </div>
          )}
          {actions.canAddEvidence !== false && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-gray-700">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Attach evidence before closing the ticket.
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
          <CheckCircle2 className="w-4 h-4 text-green-500" /> Similar resolved cases
        </div>
        {similarResolved.length > 0 ? (
          <div className="space-y-3">
            {similarResolved.map((item) => (
              <div key={item._id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold text-blue-600">
                    {item.complaintId}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {item.timeline?.resolvedAt
                      ? new Date(item.timeline.resolvedAt).toLocaleDateString()
                      : "Resolved"}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2">
                  {item.title}
                </h4>
                <p className="mt-2 text-xs text-gray-500 line-clamp-3">
                  {item.resolution?.remarks || item.resolution?.summary || "No resolution notes available."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No matching resolved cases were found for this ticket yet.
          </div>
        )}
      </div>
    </aside>
  );
};

export default ResolutionCopilot;
