import React from "react";
import { render, screen } from "@testing-library/react";
import DprPhotoGallery from "./DprPhotoGallery";

test("shows only normalized DPR photo evidence and opens the original in a new tab", () => {
  render(
    <DprPhotoGallery
      report={{
        photos: [
          {
            id: "photo-01",
            storagePath: "dprPhotos/supervisor-1/dpr-1/photo-01.jpg",
            url: "https://firebasestorage.googleapis.com/photo-01",
          },
          { storagePath: "outside/dpr", url: "https://example.com/not-allowed" },
        ],
      }}
    />
  );

  expect(screen.getByRole("heading", { name: /site photo evidence/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Site evidence 1" })).toHaveAttribute(
    "loading",
    "lazy"
  );
  expect(screen.getByRole("link", { name: /open site photo 1/i })).toHaveAttribute(
    "href",
    "https://firebasestorage.googleapis.com/photo-01"
  );
  expect(screen.queryByRole("img", { name: "Site evidence 2" })).not.toBeInTheDocument();
});

test("does not render an empty evidence section for legacy DPRs without valid photos", () => {
  const { container } = render(<DprPhotoGallery report={{ photos: [{ url: "https://example.com/no-path" }] }} />);
  expect(container).toBeEmptyDOMElement();
});