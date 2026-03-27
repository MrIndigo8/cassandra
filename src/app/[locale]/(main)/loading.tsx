export default function MainLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded-md" />
        <div className="h-4 w-80 skeleton rounded-md" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="h-4 w-1/3 skeleton rounded mb-3" />
            <div className="h-3 w-full skeleton rounded mb-2" />
            <div className="h-3 w-4/5 skeleton rounded mb-2" />
            <div className="h-3 w-2/5 skeleton rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

