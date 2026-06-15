export default async function handler(req, res) {
    // Nur POST-Requests erlauben
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Methode nicht erlaubt.' });
    }

    const apiKey = process.env.GEMINI_API_KEY; // Wir behalten den Variablennamen aus Vercel bei
    if (!apiKey) {
        return res.status(500).json({ error: 'Konfigurationsfehler: API-Key auf Vercel fehlt.' });
    }

    const { meal } = req.body;
    if (!meal) {
        return res.status(400).json({ error: 'Keine Mahlzeit zur Analyse übergeben.' });
    }

    const systemPrompt = `Du bist ein präziser Ernährungsrechner. Analysiere die Mahlzeit des Users und gib AUSSCHLIESSLICH ein valides JSON-Objekt zurück. Keine Einleitung, keine Formatierung, kein Markdown.
Pflicht-Format:
{
  "kcal": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0
}`;

    try {
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://vercel.com',
                'X-Title': 'Nutrition Tracker Pro'
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct:free", // Leistungsstarkes, stabiles Gratis-Modell
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analysiere diese Mahlzeit: ${meal}` }
                ],
                response_format: { type: "json_object" }, // Zwingt das Modell zu purem JSON
                temperature: 0.1
            })
        });

        const data = await openRouterResponse.json();

        if (!openRouterResponse.ok) {
            return res.status(openRouterResponse.status).json({ 
                error: data.error?.message || 'Fehler bei der Kommunikation mit OpenRouter.' 
            });
        }

        // Antwort extrahieren und parsen
        const contentText = data.choices?.[0]?.message?.content;
        if (!contentText) {
            throw new Error('Die KI hat keine lesbare Antwort generiert.');
        }

        const nutritionData = JSON.parse(contentText.trim());

        // Saubere, gerundete Zahlen ans Frontend zurückgeben
        return res.status(200).json({
            kcal: Math.round(nutritionData.kcal || 0),
            protein: Math.round((nutritionData.protein || 0) * 10) / 10,
            carbs: Math.round((nutritionData.carbs || 0) * 10) / 10,
            fat: Math.round((nutritionData.fat || 0) * 10) / 10
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: `Server-Fehler: ${error.message}` });
    }
}
