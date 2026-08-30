import React from "react";
import { getDprPhotoMetadata } from "../utils/dprPhotos";
import "../Styles/DprPhotoGallery.css";

function DprPhotoGallery({ report, photos, title = "📷 Site Photo Evidence", compact = false }) {
  const evidence = Array.isArray(photos)
    ? getDprPhotoMetadata({ photos })
    : getDprPhotoMetadata(report);

  if (evidence.length === 0) return null;

  return (
    <section className={`dpr-photo-gallery${compact ? " dpr-photo-gallery-compact" : ""}`}>
      {title && (
        <div className="dpr-photo-gallery-heading">
          <h3>{title}</h3>
          <span>{evidence.length} photo{evidence.length > 1 ? "s" : ""}</span>
        </div>
      )}
      <div className="dpr-photo-gallery-grid">
        {evidence.map((photo, index) => (
          <a
            className="dpr-photo-gallery-item"
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            key={`${photo.storagePath}-${index}`}
            aria-label={`Open site photo ${index + 1} in a new tab`}
          >
            <img src={photo.url} alt={`Site evidence ${index + 1}`} loading="lazy" />
            <span>Open</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default DprPhotoGallery;