import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("calls toggle when clicked", () => {
    const toggle = vi.fn();
    render(<ThemeToggle dark={false} toggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: /toggle dark mode/i }));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("shows the sun icon in dark mode and the moon icon in light mode", () => {
    const { container, rerender } = render(
      <ThemeToggle dark={true} toggle={() => {}} />,
    );
    // Dark mode → sun icon → has a <circle> for the sun.
    expect(container.querySelector("circle")).not.toBeNull();

    rerender(<ThemeToggle dark={false} toggle={() => {}} />);
    // Light mode → moon icon → no <circle>.
    expect(container.querySelector("circle")).toBeNull();
  });
});
