export default function PropertiesLoading() {
  return (
    <main className="properties-page-shell" aria-busy="true" aria-label="Chargement du patrimoine">
      <div className="properties-page">
        <div className="properties-skeleton-heading">
          <span />
          <span />
        </div>
        <div className="properties-loading-grid">
          <div className="properties-loading-panel" />
          <div className="properties-loading-panel" />
        </div>
        <p className="visually-hidden">Chargement des biens, propriétaires et lots…</p>
      </div>
    </main>
  );
}
