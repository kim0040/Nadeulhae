import { mockWeatherData, mockInsights, mockTrends, mockCourse } from "@/data/mockData"

/**
 * [BACKEND_LINK]: 데이터 연동을 위한 전용 서비스 계층입니다.
 * MOCK_MODE를 true에서 false로 바꾸고 .env.local의 NEXT_PUBLIC_API_URL을 설정하면
 * 즉시 실제 백엔드와 연결되도록 설계되었습니다.
 */

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export interface WeatherData {
  score: number;
  status: string;
  message: string;
  details: {
    temp: number;
    humidity: number;
    wind: number;
    dust: string;
    uv: string;
  };
  metadata?: {
    dataSource: string;
    lastUpdate: string;
    intervals: { kma: string; air: string };
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
  getWeatherData: async (): Promise<WeatherData> => {
    try {
      if (MOCK_MODE) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return mockWeatherData;
      }
      
      const response = await fetch(`${API_BASE}/current`, { next: { revalidate: 60 } });
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
