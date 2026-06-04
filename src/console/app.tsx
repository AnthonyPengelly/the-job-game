import { tokens } from '@/console/theme';

export function App() {
  return (
    <div
      style={{
        padding: tokens.space[8],
        fontFamily: tokens.font.sans,
      }}
    >
      <h1
        style={{
          fontSize: tokens.font.size['2xl'],
          color: tokens.color.accent,
          marginBottom: tokens.space[2],
        }}
      >
        The Job
      </h1>
      <p style={{ color: tokens.color.fgMuted, fontSize: tokens.font.size.sm }}>
        GM Console — placeholder shell (E0 scaffold)
      </p>
    </div>
  );
}
