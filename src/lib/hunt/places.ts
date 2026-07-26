import type { PlaceCandidate } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
/** Places Text Search max pageSize is 20; we pull two pages. */
const PAGE_SIZE = 20;
const MAX_PAGES = 2;

export async function searchPlaces(
  query: string,
  city: string
): Promise<PlaceCandidate[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set");
  }
  const textQuery = `${query.trim()} in ${city.trim()}`;
  const out: PlaceCandidate[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: "sl",
      regionCode: "SI",
      pageSize: PAGE_SIZE,
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,nextPageToken",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Places API ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        websiteUri?: string;
        googleMapsUri?: string;
      }>;
      nextPageToken?: string;
    };

    for (const p of data.places ?? []) {
      if (!p.id || !p.displayName?.text || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        placeId: p.id,
        name: p.displayName.text,
        address: p.formattedAddress ?? null,
        website: p.websiteUri ?? null,
        mapsUrl: p.googleMapsUri ?? null,
      });
    }

    pageToken = data.nextPageToken?.trim() || undefined;
    if (!pageToken) break;
  }

  return out;
}
