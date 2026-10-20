import { useState } from "react";
import { RACES, type RaceId } from "../../game/world/races";
import art from "../../game/world/origin-art.json";
export function RaceArtwork({
  race,
  variant = "card",
  eager = false,
}: {
  race: RaceId;
  variant?: "card" | "preview" | "full";
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      key={race + variant}
      className="ki-origin-art"
      src={failed ? RACES[race].portrait : art[race][variant]}
      width={1152}
      height={1392}
      alt={"Pełna postać: " + RACES[race].name}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={(event) => {
        if (!failed) setFailed(true);
        else event.currentTarget.alt = "Ilustracja chwilowo niedostępna: " + RACES[race].name;
      }}
    />
  );
}
