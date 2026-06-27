import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router-dom";
import { routePaths } from "../../../constants/routes";
import { AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { resetPasswordSchema, type ResetPasswordValues } from "../auth.schemas";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: params.get("token") ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(() => {
    toast("Password reset backend endpoint is not available yet.", { icon: "ℹ️" });
  });

  return (
    <AuthShell eyebrow="Secure reset" title="Reset password" description="Set a new password using your reset token.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="label">Reset token</span>
          <input className="input" {...form.register("token")} />
          {form.formState.errors.token ? <p className="mt-1 text-xs font-medium text-red-600">{form.formState.errors.token.message}</p> : null}
        </label>
        <label className="block">
          <span className="label">New password</span>
          <PasswordInput autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        </label>
        <label className="block">
          <span className="label">Confirm password</span>
          <PasswordInput autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} />
        </label>
        <button type="submit" className="btn-primary w-full">
          <KeyRound className="h-4 w-4" />
          Reset password
        </button>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <Link className="font-semibold text-blue-600" to={routePaths.login}>Back to login</Link>
        </p>
      </form>
    </AuthShell>
  );
}
