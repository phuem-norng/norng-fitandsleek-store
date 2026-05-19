import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";

const toParentCategoryLink = (gender) => {
  const g = String(gender || '').toLowerCase();
  if (!g) return '/search';
  const parent = g.charAt(0).toUpperCase() + g.slice(1);
  return `/search?parent_category=${encodeURIComponent(parent)}`;
};

function Tile({ title, to, image }) {
  return (
    <Link
      to={to}
      className="group block relative overflow-hidden rounded-2xl bg-white border border-zinc-100 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-[240px] sm:h-auto sm:aspect-[4/5] bg-zinc-100 overflow-hidden">
        {image && (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-80 transition-all duration-300 group-hover:from-black/75 group-hover:via-black/25 group-hover:opacity-100" />
      </div>
      <div className="absolute inset-0 flex flex-col justify-end text-white p-3 sm:p-5 md:p-6 pointer-events-none">
        <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow leading-tight opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-300 ease-out">
          {title}
        </h3>
      </div>
    </Link>
  );
}

export default function CollectionTiles() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const { data } = await api.get("/collections");
        const items = data?.data || [];
        
        if (items.length > 0) {
          // Transform API data to tile format
          const tiles = items.map((c) => ({
            id: c.id,
            name: c.name,
            link: c.link || toParentCategoryLink(c.gender),
            image: resolveImageUrl(c.image_url),
          }));
          setCollections(tiles);
        } else {
          setCollections([]);
        }
      } catch (error) {
        console.warn("[CollectionTiles] /collections failed:", error?.response?.status ?? error?.message);
        setCollections([]);
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
          <div className="h-[240px] sm:h-auto sm:aspect-[4/5] bg-zinc-100 animate-pulse rounded-3xl"></div>
          <div className="h-[240px] sm:h-auto sm:aspect-[4/5] bg-zinc-100 animate-pulse rounded-3xl"></div>
        </div>
      </section>
    );
  }

  if (collections.length === 0) {
    return null;
  }

  return (
    <section className="container-safe mt-10 max-w-[1600px] mx-auto">
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
