const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:9090/api" : "/api");

function withParams(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function readJson(path, params) {
  const response = await fetch(withParams(path, params), {
    headers: { Accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.details || payload.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export function dateParams(range) {
  return {
    startDate: range.startDate,
    endDate: range.endDate
  };
}

export const api = {
  firstPartySummary: (params) => readJson("/first-party/summary", params),
  firstPartyStreamUrl: (params) => withParams("/first-party/stream", params)
};
