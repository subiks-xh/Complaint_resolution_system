// Re-export the hook implementation from the context to avoid duplication
import { useAuth as contextUseAuth } from "../context/AuthContext";

export const useAuth = contextUseAuth;

export default contextUseAuth;
