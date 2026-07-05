"use client";

import { useEffect, useState } from "react";
import type { HourlyForecastItem } from "@/components/today-hourly-forecast";
import type { WeatherImageData } from "@/components/weather-image-panel";
import type { FireSummaryData, WeatherData } from "@/services/dataService";
import { dataService } from "@/services/dataService";
import { mockWeatherData } from "@/data/mockData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build URLSearchParams for the weather-images API based on current conditions. */
function buildWeatherImagesParams(weatherData: WeatherData): URLSearchParams {
  const extras = new Set<string>();
  const bulletinSummary = String(weatherData.metadata?.bulletin?.summary || "");

  const hasDustIssue =
    (weatherData.details.pm10 ?? 0) >= 51 ||
    (weatherData.details.pm25 ?? 0) >= 26 ||
    /나쁨|매우|bad|very/i.test(String(weatherData.details.dust || "")) ||
    /황사|dust/i.test(bulletinSummary);

  const hasFogSignal =
    (weatherData.details.humidity ?? 0) >= 90 ||
    /안개|fog/i.test(bulletinSummary);

  const hasSevereSignal =
    weatherData.eventData?.isWeatherWarning ||
    weatherData.eventData?.isTyphoon ||
    weatherData.eventData?.isTsunami;

  const hasTyphoonSignal = Boolean(weatherData.eventData?.isTyphoon);
  const hasTsunamiSignal = Boolean(weatherData.eventData?.isTsunami);
  const hasVolcanoSignal = Boolean(weatherData.eventData?.isVolcano);

  if (hasDustIssue) extras.add("dust");
  if (hasFogSignal) extras.add("fog");
  if (hasSevereSignal) extras.add("lgt");
  if (hasTyphoonSignal) extras.add("typhoon");
  if (hasTsunamiSignal) extras.add("tsunami");
  if (hasVolcanoSignal) extras.add("volcano");

  const params = new URLSearchParams();
  if (extras.size > 0) {
    params.set("extras", Array.from(extras).join(","));
  }
  if (hasTyphoonSignal) {
    params.set(
      "typhoonTitle",
      weatherData.metadata?.alertSummary?.warningTitle ||
        weatherData.eventData?.warningMessage ||
        "태풍 감시",
    );
    params.set(
      "typhoonTm",
      weatherData.metadata?.alertSummary?.warningUpdatedAt || "",
    );
    params.set("typhoonNote", weatherData.eventData?.warningMessage || "");
  }
  if (hasTsunamiSignal) {
    params.set(
      "tsunamiTitle",
      weatherData.metadata?.alertSummary?.tsunamiTitle || "지진해일 감시",
    );
    params.set(
      "tsunamiTm",
      weatherData.metadata?.alertSummary?.tsunamiUpdatedAt || "",
    );
    params.set("tsunamiNote", weatherData.eventData?.warningMessage || "");
  }
  if (hasVolcanoSignal) {
    params.set(
      "volcanoTitle",
      weatherData.metadata?.alertSummary?.volcanoTitle || "화산 감시",
    );
    params.set(
      "volcanoTm",
      weatherData.metadata?.alertSummary?.volcanoUpdatedAt || "",
    );
    params.set("volcanoNote", weatherData.eventData?.warningMessage || "");
  }

  return params;
}

// ---------------------------------------------------------------------------
// useWeatherData – geolocation-based initial weather fetch with fallback.
// Accepts optional fixed coordinates; when omitted uses browser geolocation.
// ---------------------------------------------------------------------------

export function useWeatherData(coords?: { lat: number; lon: number }) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Apply a successful result. dataService may return mock data flagged with
    // `isFallback` (instead of throwing) when the upstream API is unavailable,
    // so treat that as an error state too — otherwise the UI would silently
    // present fabricated weather as if it were real.
    const applyResult = (data: WeatherData) => {
      setWeatherData(data);
      setError(
        (data as { isFallback?: boolean }).isFallback
          ? "Weather data is using estimated fallback values"
          : null,
      );
    };

    // Fixed coordinates — skip geolocation
    if (coords) {
      const load = async () => {
        try {
          applyResult(await dataService.getWeatherData(coords.lat, coords.lon));
        } catch (err) {
          console.error("Fixed-coords weather load failed:", err);
          setError("Failed to load weather data");
          setWeatherData(mockWeatherData);
        }
      };
      load();
      return;
    }

    // Browser geolocation path
    const loadFallback = async () => {
      try {
        applyResult(await dataService.getWeatherData());
      } catch (err) {
        console.error("Initial data load failed:", err);
        setError("Failed to load weather data");
        setWeatherData(mockWeatherData);
      }
    };

    if (!navigator.geolocation) {
      loadFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          applyResult(
            await dataService.getWeatherData(
              position.coords.latitude,
              position.coords.longitude,
            ),
          );
        } catch (err) {
          console.error("Location-based load failed:", err);
          await loadFallback();
        }
      },
      async () => {
        await loadFallback();
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 300_000,
      },
    );
  }, [coords]);

  return { weatherData, error };
}

// ---------------------------------------------------------------------------
// useDerivedWeatherData – parallel fetch of forecast + images + fire summary.
// Replaces 3 separate effects with 1 batched effect → fewer re-renders.
// ---------------------------------------------------------------------------

export interface DerivedWeatherData {
  hourlyForecast: HourlyForecastItem[];
  weatherImages: WeatherImageData;
  fireSummary: FireSummaryData | null;
}

export function useDerivedWeatherData(
  weatherData: WeatherData | null,
): DerivedWeatherData {
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastItem[]>(
    [],
  );
  const [weatherImages, setWeatherImages] = useState<WeatherImageData>(null);
  const [fireSummary, setFireSummary] = useState<FireSummaryData | null>(null);

  useEffect(() => {
    if (!weatherData) return;

    let cancelled = false;

    const loadAll = async () => {
      const lat = weatherData.metadata?.locationContext?.coordinates?.lat;
      const lon = weatherData.metadata?.locationContext?.coordinates?.lon;
      const query = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";

      const imagesParams = buildWeatherImagesParams(weatherData);
      const imagesQuery = imagesParams.toString();

      const promises: [
        Promise<unknown>,
        Promise<unknown>,
        Promise<FireSummaryData | null>,
      ] = [
        fetch(`/api/weather/forecast${query}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/weather/images${imagesQuery ? `?${imagesQuery}` : ""}`, {
          cache: "no-store",
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        weatherData.metadata?.regionKey
          ? dataService.getFireSummary({
              regionKey: weatherData.metadata.regionKey,
            })
          : Promise.resolve(null),
      ];

      const [forecastData, imagesData, fireData] = await Promise.all(promises);

      if (cancelled) return;

      if (
        forecastData &&
        typeof forecastData === "object" &&
        "todayHourly" in forecastData
      ) {
        setHourlyForecast(
          Array.isArray((forecastData as Record<string, unknown>).todayHourly)
            ? ((forecastData as Record<string, unknown>)
                .todayHourly as HourlyForecastItem[])
            : [],
        );
      }
      if (imagesData) {
        setWeatherImages(imagesData as WeatherImageData);
      }
      setFireSummary(fireData);
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [weatherData]);

  return { hourlyForecast, weatherImages, fireSummary };
}

// ---------------------------------------------------------------------------
// Individual hooks (kept for components that only need one piece of data)
// ---------------------------------------------------------------------------

export function useHourlyForecast(weatherData: WeatherData | null) {
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastItem[]>(
    [],
  );

  useEffect(() => {
    if (!weatherData) return;

    const load = async () => {
      try {
        const lat = weatherData.metadata?.locationContext?.coordinates?.lat;
        const lon = weatherData.metadata?.locationContext?.coordinates?.lon;
        const query =
          lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";
        const response = await fetch(`/api/weather/forecast${query}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        setHourlyForecast(
          Array.isArray(data?.todayHourly) ? data.todayHourly : [],
        );
      } catch (err) {
        console.error("Failed to load hourly forecast:", err);
      }
    };

    load();
  }, [weatherData]);

  return hourlyForecast;
}

export function useWeatherImages(weatherData: WeatherData | null) {
  const [weatherImages, setWeatherImages] = useState<WeatherImageData>(null);

  useEffect(() => {
    if (!weatherData) return;

    const load = async () => {
      try {
        const params = buildWeatherImagesParams(weatherData);
        const query = params.toString();
        const response = await fetch(
          `/api/weather/images${query ? `?${query}` : ""}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json();
        setWeatherImages(data);
      } catch (err) {
        console.error("Failed to load weather images:", err);
      }
    };

    load();
  }, [weatherData]);

  return weatherImages;
}

export function useFireSummary(weatherData: WeatherData | null) {
  const [fireSummary, setFireSummary] = useState<FireSummaryData | null>(null);

  useEffect(() => {
    if (!weatherData?.metadata?.regionKey) return;

    const load = async () => {
      const summary = await dataService.getFireSummary({
        regionKey: weatherData.metadata?.regionKey,
      });
      setFireSummary(summary);
    };

    load();
  }, [weatherData?.metadata?.regionKey]);

  return fireSummary;
}
