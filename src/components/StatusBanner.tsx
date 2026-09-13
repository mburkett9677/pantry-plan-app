export function StatusBanner({
  tone,
  children,
}: {
  tone: "ok" | "error" | "info";
  children: React.ReactNode;
}) {
  const styles =
    tone === "ok"
      ? { background: "#d8efe7", color: "#1f6f5b" }
      : tone === "error"
        ? { background: "#f6e4e1", color: "#a33b2d" }
        : { background: "#eef2f0", color: "#5b6a63" };

  return (
    <div
      className="panel"
      role="status"
      style={{
        ...styles,
        borderColor: "transparent",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
