import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "../components/feedback/ErrorBoundary";
import { router } from "../routes/router";

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
