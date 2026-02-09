import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../src/state/auth";
import { AuthPage } from "../src/ui/AuthPage";

describe("App", () => {
  it("renders title", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve(JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "Unauthorized" },
      })),
    }));

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthPage mode="login" />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });
});
