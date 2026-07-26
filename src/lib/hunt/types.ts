export type ProspectStatus = "pooled" | "queued_today" | "kept" | "skipped";

export type Prospect = {
  id: string;
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  website: string | null;
  mapsUrl: string | null;
  query: string;
  status: ProspectStatus;
  queuedOn: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaceCandidate = {
  placeId: string;
  name: string;
  address: string | null;
  website: string | null;
  mapsUrl: string | null;
};
