import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Create Access"
      title="Create a simple operator account."
      description="Register with the basics and get straight into the platform. We keep the initial setup light so teams can onboard quickly and start reporting signals without friction."
      alternateLabel="Already registered?"
      alternateHref="/login"
      alternateText="Sign in"
    >
      <AuthForm mode="register" />
    </AuthShell>
  );
}
