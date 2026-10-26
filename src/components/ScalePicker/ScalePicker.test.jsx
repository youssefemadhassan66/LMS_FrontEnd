import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScalePicker from "./ScalePicker";

const Harness = ({ initial = 3, max = 5, captions }) => {
  const [value, setValue] = useState(initial);
  return <ScalePicker label="Coding" value={value} max={max} captions={captions} onChange={setValue} />;
};

describe("ScalePicker", () => {
  it("is a labelled group with one radio per step", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: /coding/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "3" })).toBeChecked();
  });

  it("picks a score with a click and fills the steps up to it", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByRole("radio", { name: "5" }));

    expect(screen.getByRole("radio", { name: "5" })).toBeChecked();
    expect(container.querySelectorAll(".is-filled")).toHaveLength(5);
    expect(container.querySelector(".scale-picker")).toHaveAttribute("data-tone", "high");
  });

  it("moves with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("radio", { name: "3" }));
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("radio", { name: "2" })).toBeChecked();
  });

  it("names each step with its caption", () => {
    render(<Harness initial={7} max={10} captions={{ 7: "Very good" }} />);
    expect(screen.getByRole("radio", { name: "7 – Very good" })).toBeChecked();
  });
});
