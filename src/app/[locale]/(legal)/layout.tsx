export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cosmos py-10 px-4">
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  );
}
