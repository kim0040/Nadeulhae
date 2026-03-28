import { mockWeatherData, mockInsights, mockTrends, mockCourse } from "@/data/mockData"

/**
 * [BACKEND_LINK]: 데이터 연동을 위한 전용 서비스 계층입니다.
 * MOCK_MODE를 true에서 false로 바꾸고 .env.local의 NEXT_PUBLIC_API_URL을 설정하면
 * 즉시 실제 백엔드와 연결되도록 설계되었습니다.
 */

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/weather";

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
      
      const query = (lat && lon) ? `?lat=${lat}&lon=${lon}` : '';
      const response = await fetch(`${API_BASE}/current${query}`, { next: { revalidate: 60 } });
      if (!response.ok) throw new Error("Weather API error");
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch weather data:", error);
      return mockWeatherData; // Fallback to mock on error
    }
  },

  // 과거 데이터 기반 인사이트 가져오기
  getInsights: async (): Promise<Insight[]> => {
    try {
      if (MOCK_MODE) return mockInsights as Insight[];
      
      const response = await fetch(`${API_BASE}/insights`);
      if (!response.ok) throw new Error("Insights API error");
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch insights:", error);
      return mockInsights as Insight[];
    }
  },

  // 현재 트렌드 키워드 가져오기
  getTrends: async (): Promise<string[]> => {
    try {
      if (MOCK_MODE) return mockTrends;
      
      const response = await fetch(`${API_BASE}/trends`);
      if (!response.ok) throw new Error("Trends API error");
      return await response.json();
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
  }
};
