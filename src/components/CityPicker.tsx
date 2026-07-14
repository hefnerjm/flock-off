import { useState } from "preact/hooks";

export interface MunicipalityOption {
  slug: string;
  name: string;
}

interface Props {
  municipalities: MunicipalityOption[];
}

export default function CityPicker({ municipalities }: Props) {
  const [slug, setSlug] = useState("");

  function go(e: Event) {
    e.preventDefault();
    if (slug) window.location.href = `/act/${slug}`;
  }

  return (
    <form class="city-picker" onSubmit={go}>
      <label>
        <span class="sr-only">Choose your city</span>
        <select value={slug} onChange={(e) => setSlug((e.target as HTMLSelectElement).value)}>
          <option value="">Choose your city…</option>
          {municipalities.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!slug}>
        Get my city's brief
      </button>
    </form>
  );
}
