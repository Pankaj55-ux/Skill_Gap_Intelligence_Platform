import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../../services/auth.service";
import { useAuthStore } from "../../../store/auth.store";
import { routePaths } from "../../../constants/routes";
import { AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { loginFormSchema, type LoginFormValues } from "../auth.schemas";
import { routeForRole } from "../roleRedirect";
import { normalizeApiError } from "../../../services/apiClient";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await authService.login({ email: values.email, password: values.password });
      setSession({ user: result.user, accessToken: result.accessToken, rememberMe: values.rememberMe });
      toast.success("Welcome back");
      navigate(routeForRole(result.user.role), { replace: true });
    } catch (error) {
      const apiError = normalizeApiError(error);
      if (apiError.code === "INVALID_CREDENTIALS") {
        form.setError("password", {
          type: "server",
          message: "Wrong password",
        }, { shouldFocus: true });
      }
    }
  });

  return (
    <AuthShell eyebrow="Sign in" title="Welcome back" description="Access your Skill Gap Intelligence workspace.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email ? <p className="mt-1 text-xs font-medium text-red-600">{form.formState.errors.email.message}</p> : null}
        </label>

        <label className="block">
          <span className="label">Password</span>
          <PasswordInput autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        </label>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("rememberMe")} />
            Remember me
          </label>
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to={routePaths.forgotPassword}>Forgot password?</Link>
        </div>

        <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary w-full">
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          New here? <Link className="font-semibold text-blue-600" to={routePaths.register}>Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}
