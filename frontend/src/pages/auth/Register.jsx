import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth";
import RegisterDialog from "../../components/dialogs/RegisterDialog";

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSwitchToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-[100dvh] min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-6 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <RegisterDialog
        isOpen={true}
        onClose={() => navigate("/")}
        onSwitchToLogin={handleSwitchToLogin}
      />
    </div>
  );
}
