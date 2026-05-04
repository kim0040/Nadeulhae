import { mockWeatherData, mockInsights, mockTrends, mockCourse } from "@/data/mockData"

/**
 * [BACKEND_LINK]: 데이터 연동을 위한 전용 서비스 계층입니다.
 * MOCK_MODE를 true에서 false로 바꾸고 .env.local의 NEXT_PUBLIC_API_URL을 설정하면
 * 즉시 실제 백엔드와 연결되도록 설계되었습니다.
 */

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/weather";

// ---- In-memory cache with TTL + request deduplication ----

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const API_CACHE_MAX_KEYS = 256;
const apiCache = new Map<string, CacheEntry<unknown>>();
const apiInFlight = new Map<string, Promise<unknown>>();

/** Read a cached value by key; returns null if expired or missing */
function getCachedValue<T>(key: string): T | null {
  const cached = apiCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    apiCache.delete(key);
    return null;
  }
  return cached.value as T;
}

/** Store a value with TTL; evicts oldest entries if cache exceeds API_CACHE_MAX_KEYS */
function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  apiCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  if (apiCache.size <= API_CACHE_MAX_KEYS) {
    return;
  }

  // Evict oldest entries (Map iteration order = insertion order)
  const overflow = apiCache.size - API_CACHE_MAX_KEYS;
  let removed = 0;
  for (const cacheKey of apiCache.keys()) {
    apiCache.delete(cacheKey);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

/** Get cached or fetch + cache; deduplicates concurrent requests for the same key */
async function getOrFetchCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCachedValue<T>(key);
  if (cached != null) {
    return cached;
  }

  const inFlight = apiInFlight.get(key) as Promise<T> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const pending = (async () => {
    const value = await fetcher();
    setCachedValue(key, value, ttlMs);
    return value;
  })();

  apiInFlight.set(key, pending as Promise<unknown>);
  try {
    return await pending;
  } finally {
    apiInFlight.delete(key);
  }
}

export interface WeatherData {
  score: number;
  status: string;
  message: string;
  isFallback?: boolean;
  eventData?: {
    isEarthquake: boolean;
    isWeatherWarning: boolean;
    isRain: boolean;
    isTyphoon?: boolean;
    isTsunami?: boolean;
    isVolcano?: boolean;
    warningMessage?: string;
  };
  details: {
    temp: number;
    humidity: number;
    wind: number;
    dust: string;
    sky?: number;
    pm10?: number;
    pm25?: number;
    o3?: number;
    no2?: number;
    co?: number;
    so2?: number;
    khai?: number;
    khaiGrade?: number;
    pty?: number;
    rn1?: number;
    vec?: number;
    uv: string;
    kr?: string;
    who?: string;
    feelsLike?: number;
    thermalKrLevel?: "good" | "moderate" | "caution" | "danger";
    thermalWhoLevel?: "good" | "moderate" | "caution" | "danger";
  };
  metadata?: {
    dataSource: string;
    station?: string;
    region?: string;
    regionEn?: string;
    regionKey?: string;
    lastUpdate: string | { kma: string; air: string };
    intervals: { kma: string; air: string };
    cachePolicy?: {
      weatherMinutes: number;
      airMinutes: number;
      alertMinutes: number;
      forecastHours: number;
      userMinutes?: number;
    };
    scoreBreakdown?: {
      air: number;
      temperature: number;
      sky: number;
      wind: number;
      knockout: string;
      total: number;
    };
    bulletin?: {
      summary?: string;
      warningStatus?: string;
      updatedAt?: string;
    };
    alertSummary?: {
      warningTitle?: string;
      warningUpdatedAt?: string;
      earthquakeTitle?: string;
      earthquakeUpdatedAt?: string;
      earthquakeMagnitude?: number;
      earthquakeCoordinates?: {
        lat?: number | null;
        lon?: number | null;
      } | null;
      earthquakeImageUrl?: string;
      tsunamiTitle?: string;
      tsunamiUpdatedAt?: string;
      volcanoTitle?: string;
      volcanoUpdatedAt?: string;
      hazardTags?: string[];
    };
    locationContext?: {
      coordinates?: {
        lat?: number | null;
        lon?: number | null;
        source?: string;
      };
      grid?: {
        nx?: number;
        ny?: number;
      };
      tm?: {
        x?: number | null;
        y?: number | null;
      };
      stationMap?: {
        selected?: string;
        source?: string;
        candidates?: Array<{ name: string; distanceKm?: number }>;
      };
      profile?: {
        key?: string;
        weatherStationId?: string;
        forecastLandReg?: string;
        forecastTempReg?: string;
      };
    };
  };
}

export interface Insight {
  name: string;
  description: string;
  icon: string;
  className: string;
  bgText?: string;
  bgEffect?: string;
  href: string;
  cta: string;
}

export interface FireSummaryData {
  regionKey: string;
  regionName: string;
  fireSidoName: string;
  metadata: {
    source: string;
    latestDate: string;
    coverageDays: number;
    cacheHours: number;
  };
  overview: {
    latestFireReceipt: number;
    latestInProgress: number;
    latestSituationEnd: number;
    sevenDayAverage: number;
    sevenDayTotal: number;
    peakDate: string;
    peakFireReceipt: number;
    cautionLevel: "low" | "moderate" | "high";
    showOnHome: boolean;
    shortMessageKo: string;
    shortMessageEn: string;
    shortMessageZh: string;
    shortMessageJa: string;
  };
  dailyTrend: Array<{
    date: string;
    fireReceipt: number;
    inProgress: number;
  }>;
  topPlaces: Array<{
    name: string;
    count: number;
    propertyDamage: number;
    casualties: number;
    outdoor: boolean;
  }>;
}

export const dataService = {
  // 실시간 날씨 및 피크닉 지수 가져오기
  getWeatherData: async (lat?: number, lon?: number): Promise<WeatherData> => {
    try {
      if (MOCK_MODE) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Dynamic mock data for testing UI changes
        const states = [
          { score: 95, status: "status_excellent", message: "msg_excellent" },
          { score: 72, status: "status_good", message: "msg_good" },
          { score: 45, status: "status_fair", message: "msg_fair" }
        ];
        
        // Rotate state based on current time (minutes) to show different states on refresh
        const stateIndex = Math.floor(Date.now() / 15000) % states.length;
        return {
          ...mockWeatherData,
          ...states[stateIndex],
          details: {
            ...mockWeatherData.details,
            temp: states[stateIndex].score === 95 ? 22 : states[stateIndex].score === 72 ? 26 : 31
          }
        };
      }

      const hasCoords = lat != null && lon != null;
      const latKey = hasCoords ? lat.toFixed(3) : "default";
      const lonKey = hasCoords ? lon.toFixed(3) : "default";
      const cacheKey = `weather:${latKey}:${lonKey}`;

      return await getOrFetchCached(cacheKey, 45_000, async () => {
        const query = hasCoords ? `?lat=${lat}&lon=${lon}` : "";
        const response = await fetch(`${API_BASE}/current${query}`, { next: { revalidate: 60 } });
        if (!response.ok) throw new Error("Weather API error");
        return await response.json();
      });
    } catch (error) {
      console.error("Failed to fetch weather data:", error);
      return mockWeatherData; // Fallback to mock on error
    }
  },

  // 과거 데이터 기반 인사이트 가져오기
  getInsights: async (): Promise<Insight[]> => {
    try {
      if (MOCK_MODE) return mockInsights as Insight[];

      return await getOrFetchCached("insights:default", 5 * 60_000, async () => {
        const response = await fetch(`${API_BASE}/insights`);
        if (!response.ok) throw new Error("Insights API error");
        return await response.json();
      });
    } catch (error) {
      console.error("Failed to fetch insights:", error);
      return mockInsights as Insight[];
    }
  },

  // 현재 트렌드 키워드 가져오기
  getTrends: async (): Promise<string[]> => {
    try {
      if (MOCK_MODE) return mockTrends;

      return await getOrFetchCached("trends:default", 10 * 60_000, async () => {
        const response = await fetch(`${API_BASE}/trends`);
        if (!response.ok) throw new Error("Trends API error");
        return await response.json();
      });
    } catch (error) {
      console.error("Failed to fetch trends:", error);
      return mockTrends;
    }
  },

  // AI 추천 코스 생성하기
  generateCourse: async (params: { timeRange: string; location: string }) => {
    try {
      if (MOCK_MODE) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return mockCourse;
      }
      
      const response = await fetch(`${API_BASE}/recommendations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error("AI Recommendation error");
      return await response.json();
    } catch (error) {
      console.error("Failed to generate course:", error);
      return mockCourse;
    }
  },

  getFireSummary: async (params?: { regionKey?: string; lat?: number; lon?: number; days?: number }): Promise<FireSummaryData | null> => {
    try {
      const query = new URLSearchParams()
      if (params?.regionKey) query.set("regionKey", params.regionKey)
      if (params?.lat != null) query.set("lat", String(params.lat))
      if (params?.lon != null) query.set("lon", String(params.lon))
      if (params?.days != null) query.set("days", String(params.days))

      const cacheKey = `fire:${query.toString() || "default"}`
      return await getOrFetchCached(cacheKey, 30 * 60_000, async () => {
        const response = await fetch(`/api/fire/summary${query.toString() ? `?${query.toString()}` : ""}`, {
          next: { revalidate: 60 * 60 },
        })
        if (!response.ok) return null
        return await response.json()
      })
    } catch (error) {
      console.error("Failed to fetch fire summary:", error)
      return null
    }
  },
};
