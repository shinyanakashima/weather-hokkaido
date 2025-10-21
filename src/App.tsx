import { useEffect, useMemo, useState } from "react";

// 北海道7都市（緯度経度で曖昧さ回避）
const CITIES: { id: string; name: string; lat: number; lon: number }[] = [
	{ id: "sapporo", name: "札幌", lat: 43.0618, lon: 141.3545 },
	{ id: "asahikawa", name: "旭川", lat: 43.7649, lon: 142.373 },
	{ id: "hakodate", name: "函館", lat: 41.7687, lon: 140.7288 },
	{ id: "wakkanai", name: "稚内", lat: 45.4156, lon: 141.673 },
	{ id: "abashiri", name: "網走", lat: 44.0206, lon: 144.2733 },
	{ id: "obihiro", name: "帯広", lat: 42.9236, lon: 143.196 },
	{ id: "kushiro", name: "釧路", lat: 42.9849, lon: 144.3817 },
];

type Units = "metric" | "imperial";

interface OWCurrent {
	dt: number;
	timezone: number;
	weather: { icon: string; main: string; description: string }[];
	main: {
		temp: number;
		feels_like: number;
		temp_min: number;
		temp_max: number;
		pressure: number;
		humidity: number;
	};
	wind: { speed: number };
}

function toLocalString(tsSec: number, tzSec: number) {
	// UTC秒 + タイムゾーン秒を加算して“現地時刻”にしてから表示
	const localMs = (tsSec + tzSec) * 1000;
	const d = new Date(localMs);
	return d.toLocaleString("ja-JP", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function iconUrl(code: string) {
	return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

async function fetchCityWeather(
	lat: number,
	lon: number,
	units: Units,
	signal?: AbortSignal
): Promise<OWCurrent> {
	const key = import.meta.env.VITE_OPENWEATHER_KEY as string;
	const url = new URL("https://api.openweathermap.org/data/2.5/weather");
	url.searchParams.set("lat", String(lat));
	url.searchParams.set("lon", String(lon));
	url.searchParams.set("appid", key);
	url.searchParams.set("units", units);

	const res = await fetch(url.toString(), { signal });
	if (!res.ok) throw new Error(`OpenWeather error ${res.status}`);
	return res.json();
}

export default function App() {
	const [units, setUnits] = useState<Units>("metric");
	const [data, setData] = useState<Record<string, OWCurrent | Error>>({});
	const [loading, setLoading] = useState(false);

	const tempUnit = units === "metric" ? "°C" : "°F";
	const windUnit = units === "metric" ? "m/s" : "mph";

	useEffect(() => {
		const ac = new AbortController();
		setLoading(true);

		(async () => {
			try {
				const entries = await Promise.all(
					CITIES.map(async (c) => {
						try {
							const w = await fetchCityWeather(c.lat, c.lon, units, ac.signal);
							return [c.id, w] as const;
						} catch (e: any) {
							return [c.id, e as Error] as const;
						}
					})
				);
				setData(Object.fromEntries(entries));
			} finally {
				setLoading(false);
			}
		})();

		return () => ac.abort();
	}, [units]);

	const hasError = useMemo(() => Object.values(data).some((v) => v instanceof Error), [data]);

	return (
		<div className='min-h-screen bg-slate-50 text-slate-900'>
			<div className='mx-auto max-w-6xl px-4 py-6 portrait:mx-0 portrait:max-w-none portrait:w-screen portrait:px-6'>
				<header className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
					<div>
						<h1 className='text-2xl font-bold tracking-tight portrait:text-3xl'>
							北海道・各地の現在天気
						</h1>
						<p className='text-sm text-slate-600'>IT事業部イノベーション課</p>
					</div>

					<div className='inline-flex overflow-hidden rounded-2xl border border-slate-200 shadow-sm'>
						<button
							className={`px-3 py-2 text-sm ${
								units === "metric" ? "bg-white" : "bg-slate-100"
							}`}
							onClick={() => setUnits("metric")}>
							°C / m/s
						</button>
						<button
							className={`px-3 py-2 text-sm ${
								units === "imperial" ? "bg-white" : "bg-slate-100"
							}`}
							onClick={() => setUnits("imperial")}>
							°F / mph
						</button>
					</div>
				</header>

				{loading && (
					<div className='mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow'>
						読み込み中…
					</div>
				)}
				{hasError && (
					<div className='mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
						一部の都市で取得に失敗しました。時間をおいて再試行してください。
					</div>
				)}

				<ul className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 portrait:grid-cols-2 portrait:gap-6'>
					{CITIES.map((c) => {
						const v = data[c.id];
						const err = v instanceof Error ? v : null;
						const w = v && !(v instanceof Error) ? (v as OWCurrent) : null;

						return (
							<li
								key={c.id}
								className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
								<div className='flex items-start justify-between'>
									<div>
										<h2 className='text-lg font-semibold'>{c.name}</h2>
										<p className='text-xs text-slate-500'>
											{w ? toLocalString(w.dt, w.timezone) : "--"}
										</p>
									</div>
									{w && (
										<img
											className='-mr-2 -mt-2 h-16 w-16'
											src={iconUrl(w.weather[0].icon)}
											alt={w.weather[0].description}
											loading='lazy'
										/>
									)}
								</div>

								{!w && !err && (
									<p className='mt-4 text-sm text-slate-500'>取得中…</p>
								)}
								{err && (
									<p className='mt-4 text-sm text-red-600'>
										取得エラー: {String(err.message)}
									</p>
								)}

								{w && (
									<div className='mt-4'>
										<div className='flex items-baseline gap-2'>
											<div className='text-4xl font-bold leading-none'>
												{Math.round(w.main.temp)}
												<span className='ml-1 text-xl font-medium'>
													{tempUnit}
												</span>
											</div>
											<div className='text-sm text-slate-600'>
												{w.weather[0].main}
											</div>
										</div>

										<dl className='mt-3 grid grid-cols-2 gap-2 text-sm'>
											<div className='rounded-xl bg-slate-50 p-2'>
												<dt className='text-slate-500'>体感</dt>
												<dd className='font-medium'>
													{Math.round(w.main.feels_like)} {tempUnit}
												</dd>
											</div>
											<div className='rounded-xl bg-slate-50 p-2'>
												<dt className='text-slate-500'>湿度</dt>
												<dd className='font-medium'>{w.main.humidity}%</dd>
											</div>
											<div className='rounded-xl bg-slate-50 p-2'>
												<dt className='text-slate-500'>風速</dt>
												<dd className='font-medium'>
													{w.wind.speed} {windUnit}
												</dd>
											</div>
											<div className='rounded-xl bg-slate-50 p-2'>
												<dt className='text-slate-500'>気圧</dt>
												<dd className='font-medium'>
													{w.main.pressure} hPa
												</dd>
											</div>
											<div className='col-span-2 rounded-xl bg-slate-50 p-2'>
												<dt className='text-slate-500'>最低 / 最高</dt>
												<dd className='font-medium'>
													{Math.round(w.main.temp_min)} /{" "}
													{Math.round(w.main.temp_max)} {tempUnit}
												</dd>
											</div>
										</dl>
									</div>
								)}
							</li>
						);
					})}
				</ul>

				<footer className='mt-8 text-center text-xs text-slate-500'>
					データ提供: OpenWeather
				</footer>
			</div>
		</div>
	);
}
