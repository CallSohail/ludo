import { useState } from "react";
import { playerMonogram, playerPortraitFile } from "./playerPortraits";

export function Avatar({ player, size = "" }) {
  const file = playerPortraitFile(player.id);
  const [failedFile, setFailedFile] = useState(null);
  const colour = /^#[0-9a-f]{6}$/i.test(player.accent || "")
    ? player.accent
    : "#287d56";
  return (
    <span
      className={`dash-avatar ${size}`}
      aria-hidden="true"
      style={{ "--avatar-colour": colour }}
    >
      {file && file !== failedFile ? (
        <img
          src={`${import.meta.env.BASE_URL}${file}`}
          alt=""
          onError={() => setFailedFile(file)}
        />
      ) : (
        playerMonogram(player.name)
      )}
    </span>
  );
}
