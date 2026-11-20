import { useState } from "react";

export function Avatar({ player, size = "" }) {
  const file = {
    mubeen: "mubeen-avatar.webp",
    sohail: "sohail-avatar.webp",
    saboor: "saboor-avatar.webp",
  }[player.name.trim().toLowerCase()];
  const [failed, setFailed] = useState(false);
  const colour = /^#[0-9a-f]{6}$/i.test(player.accent || "")
    ? player.accent
    : "#287d56";
  return (
    <span
      className={`dash-avatar ${size}`}
      aria-hidden="true"
      style={{ "--avatar-colour": colour }}
    >
      {file && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}${file}`}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        player.name
          .trim()
          .split(/\s+/)
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
