import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { routePaths } from "../../../constants/routes";
import { authService } from "../../../services/auth.service";
import { useAuthStore } from "../../../store/auth.store";
import { AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { registerFormSchema, type RegisterFormValues } from "../auth.schemas";
import { routeForRole } from "../roleRedirect";

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      rememberMe: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await authService.register({
        email: values.email,
        displayName: values.displayName,
        password: values.password,
        role: "STUDENT",
      });
      setSession({ user: result.user, accessToken: result.accessToken, rememberMe: values.rememberMe });
      toast.success("Account created");
      navigate(routeForRole(result.user.role), { replace: true });
    } catch {
      // Axios interceptor surfaces the backend message.
    }
  });

  return (
    <AuthShell eyebrow="Create account" title="Start your readiness journey" description="Student self-registration is open. Staff accounts are managed by admins.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="label">Full name</span>
          <input className="input" autoComplete="name" {...form.register("displayName")} />
          {form.formState.errors.displayName ? <p className="mt-1 text-xs font-medium text-red-600">{form.formState.errors.displayName.message}</p> : null}
        </label>

        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email ? <p className="mt-1 text-xs font-medium text-red-600">{form.formState.errors.email.message}</p> : null}
        </label>

        <label className="block">
          <span className="label">Password</span>
          <PasswordInput autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        </label>

        <label className="block">
          <span className="label">Confirm password</span>
          <PasswordInput autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("rememberMe")} />
          Keep me signed in
        </label>

        <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary w-full">
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account? <Link className="font-semibold text-blue-600" to={routePaths.login}>Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
