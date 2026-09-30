import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CountUp from "./CountUp";

describe("CountUp", () => {
  it("passes placeholders and text through untouched", () => {
    render(<CountUp value="—" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("gives screen readers the final value straight away", () => {
    const { container } = render(<CountUp value={42} suffix="%" />);
    expect(container.querySelector(".sr-only")).toHaveTextContent("42%");
  });

  it("ends on the exact target", async () => {
    const { container } = render(<CountUp value={9} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    await screen.findByText((_, node) => node === visible && node.textContent === "9", undefined, {
      timeout: 2000,
    });
  });
});
