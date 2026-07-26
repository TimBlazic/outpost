import type { PlaceCandidate } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

export async function searchPlaces(
  query: string,
  city: string
): Promise<PlaceCandidate[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set");
  }
  const textQuery = `${query.trim()} in ${city.trim()}`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "sl",
      regionCode: "SI",
      pageSize: 20,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      websiteUri?: string;
      googleMapsUri?: string;
    }>;
  };
  return (data.places ?? [])
    .filter((p) => p.id && p.displayName?.text)
    .map((p) => ({
      placeId: p.id!,
      name: p.displayName!.text!,
      address: p.formattedAddress ?? null,
      website: p.websiteUri ?? null,
      mapsUrl: p.googleMapsUri ?? null,
    }));
}
