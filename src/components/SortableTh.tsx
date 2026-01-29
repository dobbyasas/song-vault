export function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="th" onClick={onClick}>
      {label} {active ? (dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}
