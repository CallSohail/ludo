import { Activity } from "lucide-react";

export function Empty({ title = "No recorded activity", children }) {
  return (
    <div className="dash-empty">
      <Activity size={24} />
      <h3>{title}</h3>
      <p>
        {children ||
          "Score changes will appear here when history is available. Current standings are still shown."}
      </p>
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="dash-panel-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
