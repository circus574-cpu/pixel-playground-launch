import { describe, expect, it } from "vitest";
import { ITEM_CATALOG } from "../game/items/catalog";
import { EQUIPMENT_SLOTS, itemFitsSlot } from "../game/items/slots";

describe("przedmioty pasują tylko do swojego slotu", () => {
  it("surowce, ziela i skóry nie pasują do żadnego slotu", () => {
    for (const id of [
      "bursztyn",
      "mchowa-galaretka",
      "zielone-ziele",
      "skora-wilcza",
      "sok-lisciaka",
    ])
      for (const slot of EQUIPMENT_SLOTS)
        expect(itemFitsSlot(slot, id), `${id}/${slot}`).toBe(false);
  });

  it("broń pasuje tylko do slotu broni, a klasyczne ostrze i kamizelka do swoich", () => {
    const weapon = ITEM_CATALOG.find((i) => i.slot === "weapon")!;
    expect(itemFitsSlot("weapon", weapon.id)).toBe(true);
    for (const slot of EQUIPMENT_SLOTS.filter((s) => s !== "weapon"))
      expect(itemFitsSlot(slot, weapon.id)).toBe(false);
    expect(itemFitsSlot("weapon", "sword")).toBe(true);
    expect(itemFitsSlot("armor", "vest")).toBe(true);
    expect(itemFitsSlot("armor", "sword")).toBe(false);
    expect(itemFitsSlot("weapon", "potion")).toBe(false);
  });

  it("każdy slot ma przynajmniej jeden pasujący przedmiot w katalogu", () => {
    for (const slot of EQUIPMENT_SLOTS)
      expect(
        ITEM_CATALOG.some((i) => itemFitsSlot(slot, i.id)),
        slot,
      ).toBe(true);
  });

  it("nieznany slot i nieznany przedmiot są odrzucane", () => {
    expect(itemFitsSlot("tail", "sword")).toBe(false);
    expect(itemFitsSlot("weapon", "nie-ma-takiego")).toBe(false);
  });
});
