import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
const register = vi.fn();
vi.mock("../game/account/vpsAuth", () => ({
  AuthError: class extends Error {},
  confirmEmail: vi.fn(),
  forgotPassword: vi.fn(),
  login: vi.fn(),
  register: (...args: unknown[]) => register(...args),
  resendActivation: vi.fn(),
  resetPassword: vi.fn(),
}));

import { Landing } from "../components/landing/Landing";
import { RACE_LORE } from "../game/world/raceLore";
import { RACES, RACE_IDS } from "../game/world/races";
import { WORLDS } from "../game/world/worlds";

afterEach(() => {
  cleanup();
  register.mockReset();
});

describe("race lore", () => {
  it("has a biography for every race, in line with the world's capital", () => {
    for (const id of RACE_IDS) {
      const lore = RACE_LORE[id];
      expect(lore.biography).toHaveLength(3);
      for (const paragraph of lore.biography) expect(paragraph.length).toBeGreaterThan(120);
      expect(lore.settlement).toBe(
        WORLDS[RACES[id].world].city?.name ?? WORLDS[RACES[id].world].settlement,
      );
      expect(lore.starter.text.length).toBeGreaterThan(30);
    }
  });
  it("does not reveal the hidden truth of the campaign", () => {
    const all = JSON.stringify(RACE_LORE);
    for (const spoiler of ["Veyr", "Jedyny Ton", "Architekt"]) expect(all).not.toContain(spoiler);
  });
});

describe("home page for visitors", () => {
  it("describes the four origins and opens the biography on request", () => {
    render(<Landing />);
    for (const id of RACE_IDS)
      expect(screen.getByRole("heading", { name: RACES[id].name })).toBeTruthy();
    const first = RACE_IDS[0]!;
    const button = screen.getAllByRole("button", { name: "Przeczytaj biografię" })[0]!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const bio = document.getElementById(`bio-${first}`)!;
    expect(bio.hasAttribute("hidden")).toBe(true);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(bio.hasAttribute("hidden")).toBe(false);
    expect(bio.textContent).toContain(RACE_LORE[first].biography[0].slice(0, 40));
  });
  it("links the account panel, regulations and privacy policy", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { name: "Załóż konto" })).toBeTruthy();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/regulamin", "/prywatnosc", "/mapa"]));
  });
  it("does not register without accepting the regulations", () => {
    render(<Landing />);
    const form = document.querySelector("form")!;
    fireEvent.change(form.querySelector("[name=nick]")!, { target: { value: "Wedrowiec" } });
    fireEvent.change(form.querySelector("[name=email]")!, {
      target: { value: "gracz@example.com" },
    });
    fireEvent.change(form.querySelector("[name=password]")!, {
      target: { value: "dlugie-haslo-1" },
    });
    fireEvent.submit(form);
    expect(register).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("regulamin");
    register.mockResolvedValue({ message: "Sprawdź e-mail." });
    fireEvent.click(form.querySelector("[name=zgoda]")!);
    fireEvent.submit(form);
    expect(register).toHaveBeenCalledWith("gracz@example.com", "dlugie-haslo-1", "Wedrowiec");
  });
});
