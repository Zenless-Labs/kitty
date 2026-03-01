import { useState, useEffect } from 'react';

// Pyth SUI/USD price feed ID
const SUI_USD_FEED = '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744';

export function useSuiPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SUI_USD_FEED}`
        );
        const data = await res.json();
        const p = data.parsed[0].price;
        setPrice(p.price * Math.pow(10, p.expo));
      } catch {
        setPrice(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 30_000); // Pyth updates ~400ms, polling 30s is fine
    return () => clearInterval(interval);
  }, []);

  const usdToSui = (usd: number) => (price ? usd / price : null);
  return { price, loading, usdToSui };
}
