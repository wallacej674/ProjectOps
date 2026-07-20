import { transparency } from "./copy";

export function TransparencyPanel() {
  return (
    <div className="transparency-panel">
      <div className="eyebrow">{transparency.eyebrow}</div>
      <h2>{transparency.title}</h2>
      <p>{transparency.text}</p>
    </div>
  );
}
