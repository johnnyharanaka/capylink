import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDarkMode } from "./useDarkMode";

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("useDarkMode", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to system preference when nothing is stored", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("respects a stored preference over system preference", () => {
    mockMatchMedia(true);
    localStorage.setItem("theme", "light");
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles the dark class and persists the choice", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useDarkMode());

    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");

    act(() => result.current[1]());

    expect(result.current[0]).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");

    act(() => result.current[1]());

    expect(result.current[0]).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
