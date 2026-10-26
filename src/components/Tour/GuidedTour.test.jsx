import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuidedTour from "./GuidedTour";
import { hasSeenTour, markTourSeen, tourStepsFor } from "./tourSteps";

const steps = [
  { title: "Welcome", body: "Hello there." },
  { target: '[data-tour="missing"]', optional: true, title: "Optional", body: "Skipped when absent." },
  { target: '[data-tour="here"]', title: "Here it is", body: "Points at an element." },
  { title: "All done", body: "Bye.", finishLabel: "Let’s go!" },
];

// jsdom lays nothing out, so every element measures 0×0 and counts as
// hidden. Give the one target a real box.
const box = { top: 100, left: 100, right: 300, bottom: 140, width: 200, height: 40, x: 100, y: 100 };

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  window.localStorage.clear();
});

const renderTour = (onFinish = vi.fn()) => {
  render(
    <>
      <div data-tour="here" ref={(el) => { if (el) el.getBoundingClientRect = () => box; }}>Target</div>
      <GuidedTour steps={steps} onFinish={onFinish} />
    </>,
  );
  return onFinish;
};

describe("GuidedTour", () => {
  it("opens on a labelled welcome step", () => {
    renderTour();
    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("passes over an optional step whose element is missing", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: /show me around/i }));

    expect(screen.getByRole("dialog", { name: "Here it is" })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("goes back, and finishes from the last step", async () => {
    const user = userEvent.setup();
    const onFinish = renderTour();

    await user.click(screen.getByRole("button", { name: /show me around/i }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Let’s go!" }));
    expect(onFinish).toHaveBeenCalledWith("done");
  });

  it("can be skipped with the button or Escape", async () => {
    const user = userEvent.setup();
    const onFinish = renderTour();

    await user.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(onFinish).toHaveBeenLastCalledWith("skipped");

    await user.keyboard("{Escape}");
    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});

describe("tour steps", () => {
  it("exists for students and parents only", () => {
    expect(tourStepsFor("student", "Yassin")[0].title).toContain("Yassin");
    expect(tourStepsFor("parent", "Emad")).not.toBeNull();
    expect(tourStepsFor("admin", "Amina")).toBeNull();
    expect(tourStepsFor("instructor", "Sara")).toBeNull();
  });

  it("remembers per user that the tour was seen", () => {
    expect(hasSeenTour("u1")).toBe(false);
    markTourSeen("u1", "skipped");
    expect(hasSeenTour("u1")).toBe(true);
    expect(hasSeenTour("u2")).toBe(false);
  });
});
