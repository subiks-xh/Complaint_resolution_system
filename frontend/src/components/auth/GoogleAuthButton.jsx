import { GoogleLogin } from "@react-oauth/google";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const GoogleAuthButton = ({ mode = "login", onSuccessRedirect }) => {
  const { loginWithGoogle } = useAuth();

  const handleSuccess = async (googleResp) => {
    try {
      const credential = googleResp?.credential;
      if (!credential) {
        toast.error("Google credential not received");
        return;
      }

      const result = await loginWithGoogle(credential, mode);

      if (result?.onboardingRequired) {
        toast.success("Google account verified. Complete onboarding.");
        onSuccessRedirect?.("/onboarding");
        return;
      }

      toast.success("Google sign-in successful");
      onSuccessRedirect?.("/dashboard");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Google authentication failed",
      );
    }
  };

  return (
    <div className="w-full flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => toast.error("Google sign-in cancelled or failed")}
        text={mode === "signup" ? "signup_with" : "signin_with"}
        shape="pill"
        width="300"
      />
    </div>
  );
};

export default GoogleAuthButton;
