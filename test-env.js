const apiKey = process.env.FORTYGUARD_API_KEY;

if (!apiKey) {
  throw new Error("FORTYGUARD_API_KEY was not found");
}

async function testFortyGuard() {
  const response = await fetch(
    "https://api.fortyguard.com/v1/env_params",
    {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: 33.4484,
        longitude: -112.074,
        temperature: 42,
        date_time: {
          start_date: "2026-08-18",
          start_time: "14:00",
          filter_type: 1,
        },
      }),
    }
  );

  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

testFortyGuard().catch(console.error);
