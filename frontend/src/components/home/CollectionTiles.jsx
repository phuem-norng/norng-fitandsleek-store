import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useCatalogAvailability } from "../../state/catalogAvailability.jsx";

const toParentCategoryLink = (gender) => {
  const g = String(gender || "").toLowerCase();
  if (!g) return "/search";
  const parent = g.charAt(0).toUpperCase() + g.slice(1);
  return `/search?parent_category=${encodeURIComponent(parent)}`;
};

function Tile({ title, to, image }) {
  const resolved = image ? resolveImageUrl(image) : "";
  const [imageFailed, setImageFailed] = useState(!resolved);

  useEffect(() => {
    setImageFailed(!resolved);
  }, [resolved]);

  const showImage = Boolean(resolved) && !imageFailed;

  return (
    <Link
      to={to}
      className="group block relative overflow-hidden rounded-2xl bg-white border border-zinc-100 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-[240px] sm:h-auto sm:aspect-[4/5] overflow-hidden relative">
        {showImage ? (
          <img
            src={resolved}
            alt={title}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="w-full h-full bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-50"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent opacity-100 transition-opacity duration-300 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" />
      </div>
      <div className="absolute inset-0 flex flex-col justify-end text-white p-3 sm:p-5 md:p-6 pointer-events-none">
        <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow leading-tight opacity-100 translate-y-0 transition-all duration-300 ease-out [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-focus-visible:opacity-100 [@media(hover:hover)]:group-focus-visible:translate-y-0">
          {title}
        </h3>
      </div>
    </Link>
  );
}

export default function CollectionTiles() {
  const { infrastructureDegraded } = useCatalogAvailability();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    const fetchCollections = async () => {
      setFetchFailed(false);
      try {
        const { data } = await api.get("/collections");
        const items = data?.data || [];
        const tiles = items.map((c) => ({
          id: c.id,
          name: c.name,
          link: c.link || toParentCategoryLink(c.gender),
          image: c.image_url,
        }));
        setCollections(tiles);
      } catch (error) {
        console.warn("Failed to fetch collections:", error);
        setCollections([]);
        setFetchFailed(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  if (loading) {
    return (
      <section className="container-safe mt-8">
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          <div className="h-[240px] sm:h-auto sm:aspect-[4/5] bg-zinc-100 animate-pulse rounded-3xl" />
          <div className="h-[240px] sm:h-auto sm:aspect-[4/5] bg-zinc-100 animate-pulse rounded-3xl" />
        </div>
      </section>
    );
  }

  if (infrastructureDegraded || fetchFailed || collections.length === 0) {
    return null;
  }

  return (
    <section className="container-safe mt-10">
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
        {collections.map((tile) => (
          <Tile
            key={tile.id}
            title={tile.name}
            to={tile.link || "/search"}
            image={tile.image}
          />
        ))}
      </div>
    </section>
  );
}
