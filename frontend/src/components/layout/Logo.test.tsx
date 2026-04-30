import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Logo from "./Logo";

describe("Logo", () => {
  it("renders the </capylink> wordmark", () => {
    const { container } = render(<Logo />);
    expect(container.textContent).toBe("</capylink>");
  });

  it("accepts and applies an extra className", () => {
    render(<Logo className="text-7xl" />);
    const wrapper = screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === "</capylink>");
    expect(wrapper.className).toContain("text-7xl");
    expect(wrapper.className).toContain("font-bold");
    expect(wrapper.className).toContain("font-mono");
  });
});
