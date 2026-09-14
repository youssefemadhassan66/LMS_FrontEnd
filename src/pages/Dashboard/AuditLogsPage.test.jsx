import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditLogsPage from "./AuditLogsPage";

const mocks = vi.hoisted(() => ({ useFetchData: vi.fn() }));

vi.mock("../../hooks/useFetchData", () => ({ default: mocks.useFetchData }));

const logs = [
  {
    _id: "1",
    action: "login",
    actor: { FullName: "Sara Student", Email: "sara@example.com" },
    actorEmail: "sara@example.com",
    actorRole: "student",
    ip: "10.0.0.1",
    createdAt: "2026-09-14T09:00:00.000Z",
  },
  {
    _id: "2",
    action: "login_failed",
    // No account behind it — the case that made AuditLog.actor optional.
    actor: null,
    actorEmail: "attacker@example.com",
    ip: "10.0.0.2",
    meta: { reason: "unknown_email" },
    createdAt: "2026-09-14T09:05:00.000Z",
  },
  {
    _id: "3",
    action: "signup",
    actor: { FullName: "New Person", Email: "new@example.com" },
    actorRole: "student",
    meta: { approvalStatus: "pending", requiresApproval: true },
    createdAt: "2026-09-14T09:10:00.000Z",
  },
  {
    _id: "4",
    action: "approve_user",
    actor: { FullName: "Youssef Emad", Email: "admin@example.com" },
    actorRole: "admin",
    meta: { subjectEmail: "new@example.com", subjectName: "New Person" },
    createdAt: "2026-09-14T09:15:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useFetchData.mockReturnValue({ data: { logs }, loading: false, error: null });
});

describe("audit log page", () => {
  it("labels the auth events in words rather than raw action names", async () => {
    render(<AuditLogsPage />);

    expect((await screen.findAllByText("Signed in")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed sign-in").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Signed up").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved account").length).toBeGreaterThan(0);
    expect(screen.queryByText("login_failed")).not.toBeInTheDocument();
  });

  it("shows the attempted address when no account was behind the attempt", async () => {
    render(<AuditLogsPage />);

    expect((await screen.findAllByText("attacker@example.com")).length).toBeGreaterThan(0);
    // "Unknown" would hide the fact that the address simply does not exist.
    expect(screen.getAllByText("No account").length).toBeGreaterThan(0);
  });

  it("spells out why a sign-in failed without opening the JSON", async () => {
    render(<AuditLogsPage />);

    expect((await screen.findAllByText("No account with that email")).length).toBeGreaterThan(0);
  });

  it("names the account an approval was about", async () => {
    render(<AuditLogsPage />);

    expect((await screen.findAllByText("New Person")).length).toBeGreaterThan(0);
  });

  it("filters down to one kind of event", async () => {
    const user = userEvent.setup();
    render(<AuditLogsPage />);

    await user.click(await screen.findByRole("button", { name: "Failed sign-ins" }));

    expect(screen.getAllByText("Failed sign-in").length).toBeGreaterThan(0);
    expect(screen.queryByText("Signed in")).not.toBeInTheDocument();
    expect(screen.queryByText("Signed up")).not.toBeInTheDocument();
  });

  it("searches the readable label, not just the raw action", async () => {
    const user = userEvent.setup();
    render(<AuditLogsPage />);

    await user.type(screen.getByPlaceholderText(/search/i), "signed up");

    expect(screen.getAllByText("Signed up").length).toBeGreaterThan(0);
    expect(screen.queryByText("Signed in")).not.toBeInTheDocument();
  });
});
