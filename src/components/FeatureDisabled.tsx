export function FeatureDisabled({ name }: { name: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 text-4xl">🔒</div>
      <h2 className="mb-2 text-xl font-bold text-text-primary">Раздел временно отключён</h2>
      <p className="text-text-secondary">Раздел &ldquo;{name}&rdquo; отключён администратором. Попробуйте позже.</p>
    </div>
  );
}
