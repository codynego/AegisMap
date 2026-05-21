import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Operator Sign In"
      title="Access the command center."
      description="Sign in with your GeoPulse operator credentials to view alerts, monitor signals, and continue intelligence operations from one unified workspace."
      alternateLabel="New to the platform?"
      alternateHref="/register"
      alternateText="Create an account"
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
