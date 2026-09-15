import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AccountConnections from "./AccountConnections";

const mocks = vi.hoisted(() => ({ response: {} }));

vi.mock("../../hooks/useFetchData", () => ({
  default: (endpoint) => ({
    data: mocks.response[endpoint] ?? null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const emad = { _id: "p1", FullName: "Emad Hassan", Email: "emad@test.com" };
const ahmed = { _id: "i1", FullName: "Ahmed Teacher", Email: "ahmed@test.com" };
const mahmoud = { _id: "s1", FullName: "Mahmoud Hassan", Email: "mahmoud@test.com" };
const profile = { user: mahmoud, grade: "Grade 8", parents: [emad], instructors: [ahmed] };

const group = (name) =>
  screen.getByRole("heading", { name: new RegExp(`^${name}`) }).parentElement;

describe("AccountConnections", () => {
  beforeEach(() => {
    mocks.response = {};
  });

  it("shows a student their parents and instructors", () => {
    mocks.response["/api/v1/StudentProfile/me"] = profile;
    render(<AccountConnections role="student" />);

    expect(within(group("Parents")).getByText("Emad Hassan")).toBeInTheDocument();
    expect(within(group("Instructors")).getByText("Ahmed Teacher")).toBeInTheDocument();
  });

  it("shows a parent each child with that child's instructors", () => {
    mocks.response["/api/v1/StudentProfile/me"] = [profile];
    render(<AccountConnections role="parent" />);

    const children = group("Children");
    expect(within(children).getByText("Mahmoud Hassan")).toBeInTheDocument();
    expect(within(children).getByText("Instructors: Ahmed Teacher")).toBeInTheDocument();
  });

  it("shows an instructor each student with that student's parents", () => {
    mocks.response["/api/v1/student-instructor-assignments/me/students"] = { students: [profile] };
    render(<AccountConnections role="instructor" />);

    const students = group("Students");
    expect(within(students).getByText("Mahmoud Hassan")).toBeInTheDocument();
    expect(within(students).getByText("Parents: Emad Hassan")).toBeInTheDocument();
  });

  it("explains an empty link instead of showing a blank list", () => {
    mocks.response["/api/v1/StudentProfile/me"] = { ...profile, parents: [] };
    render(<AccountConnections role="student" />);

    expect(screen.getByText("No parent is linked to your account yet.")).toBeInTheDocument();
  });

  it("renders nothing for admins", () => {
    const { container } = render(<AccountConnections role="admin" />);
    expect(container).toBeEmptyDOMElement();
  });
});
