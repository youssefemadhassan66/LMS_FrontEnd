import React, { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import PageStage from "./PageStage";
import { beginRequest, pendingBetween, requestClock, trackRequest } from "../../utils/requestTracker";

// A page that starts one request on mount and ends it when told to.
let finishRequest;
const LoadingPage = ({ text = "Real content" }) => {
  useEffect(() => {
    finishRequest = beginRequest();
  }, []);
  return <p>{text}</p>;
};

const hidden = () => document.querySelector(".page-stage").classList.contains("is-pending");
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe("requestTracker", () => {
  it("counts a request until it settles, whether it resolves or rejects", async () => {
    const from = requestClock();
    let resolve, reject;
    trackRequest(new Promise((r) => { resolve = r; }));
    trackRequest(new Promise((_, r) => { reject = r; })).catch(() => {});
    expect(pendingBetween(from)).toBe(2);

    resolve();
    reject(new Error("boom"));
    await Promise.resolve();
    await Promise.resolve();
    expect(pendingBetween(from)).toBe(0);
  });

  it("ignores requests that started outside the window", () => {
    const end = beginRequest();
    const after = requestClock() + 1;
    expect(pendingBetween(after)).toBe(0);
    end();
  });
});

describe("PageStage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    finishRequest = undefined;
  });
  afterEach(() => {
    finishRequest?.();
    vi.useRealTimers();
  });

  it("keeps the page hidden and shows the loader until its data arrives", () => {
    render(
      <PageStage pathname="/dashboard/tasks" label="Tasks">
        <LoadingPage />
      </PageStage>,
    );

    // Hidden from the start, so its empty state never shows.
    expect(hidden()).toBe(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // A slow page gets the loading screen.
    advance(300);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Tasks");

    // Still hidden while the request is in flight, however long it takes.
    advance(2000);
    expect(hidden()).toBe(true);

    // Revealed once the request finishes and things stay quiet.
    act(() => finishRequest());
    advance(400);
    expect(hidden()).toBe(false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Real content")).toBeInTheDocument();
  });

  it("never flashes the loader for a page that settles quickly", () => {
    render(
      <PageStage pathname="/dashboard/schedule" label="Schedule">
        <p>Instant</p>
      </PageStage>,
    );

    advance(250);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    advance(100);
    expect(hidden()).toBe(false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reveals the page anyway if a request never finishes", () => {
    render(
      <PageStage pathname="/dashboard/messages" label="Messages">
        <LoadingPage />
      </PageStage>,
    );

    advance(8100);
    expect(hidden()).toBe(false);
  });

  it("starts over when the route changes", () => {
    const { rerender } = render(
      <PageStage pathname="/dashboard/tasks" label="Tasks">
        <p>Tasks page</p>
      </PageStage>,
    );
    advance(400);
    expect(hidden()).toBe(false);

    rerender(
      <PageStage pathname="/dashboard/exams" label="Exams">
        <LoadingPage text="Exams page" />
      </PageStage>,
    );
    expect(hidden()).toBe(true);
    advance(300);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Exams");
  });
});
