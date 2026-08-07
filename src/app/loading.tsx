export default function Loading(): React.JSX.Element {
  return (
    <div className="space-y-6 px-4 pt-24 md:px-12 md:pt-28" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_unused, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
