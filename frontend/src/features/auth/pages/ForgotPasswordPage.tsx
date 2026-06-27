import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { routePaths } from "../../../constants/routes";
import { AuthShell } from "../components/AuthShell";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../auth.schemas";

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(() => {
    toast("Password reset backend endpoint is not available yet.", { icon: "ℹ️" });
  });

  return (
    <AuthShell eyebrow="Recover access" title="Forgot password" description="Enter your account email to start password recovery.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email ? <p className="mt-1 text-xs font-medium text-red-600">{form.formState.errors.email.message}</p> : null}
        </label>
        <button type="submit" className="btn-primary w-full">
          <Mail className="h-4 w-4" />
          Request reset link
        </button>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Remembered it? <Link className="font-semibold text-blue-600" to={routePaths.login}>Back to login</Link>
        </p>
      </form>
    </AuthShell>
  );
}
