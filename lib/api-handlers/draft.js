const SYSTEM_INSTRUCTIONS = `Write a weather-awareness social post for the selected platform that follows the supplied style preferences. Use only the event, location, and supplied draft text. Do not invent warning details, timing, risk, impacts, or official instructions. Do not imply that the post is an official agency alert. Encourage readers to check their local meteorological service and follow emergency instructions. Return only the post text.`;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, platform, event, area, draft, config = {} } = request.body || {};
  const providerName = provider === 'Gemini' ? 'Gemini' : provider === 'ChatGPT' ? 'ChatGPT' : '';
  if (!providerName || !['YouTube', 'TikTok'].includes(platform)) {
    return response.status(400).json({ error: 'Choose ChatGPT or Gemini and a supported platform.' });
  }

  const tones={reassuring:'reassuring and steady',direct:'direct and clear',conversational:'conversational',formal:'formal and measured'};
  const lengths={short:'short',standard:'standard length',detailed:'detailed but easy to scan'};
  const audiences={local:'local community',drivers:'road users',general:'general followers'};
  const formats={warning:'warning update',forecast:'general weather update',preparedness:'preparedness reminder'};
  const preferences=[
    `Tone: ${tones[config.tone]||tones.reassuring}`,
    `Length: ${lengths[config.length]||lengths.standard}`,
    `Audience: ${audiences[config.audience]||audiences.local}`,
    `Post focus: ${formats[config.format]||formats.warning}`,
    `Include the location name: ${config.includeLocation===false?'no':'yes'}`,
    `Suggest relevant hashtags: ${config.includeHashtags===false?'no':'yes'}`
  ].join('\n');
  const prompt = [
    `Platform: ${platform}`,
    `Style preferences:\n${preferences}`,
    `Official alert or update: ${String(event || 'Weather update').slice(0, 180)}`,
    `Location: ${String(area || 'Selected area').slice(0, 140)}`,
    `User draft: ${String(draft || '').slice(0, 1600)}`
  ].join('\n');

  try {
    let caption = '';
    if (providerName === 'ChatGPT') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return response.status(503).json({ error: 'Add OPENAI_API_KEY in the Vercel project settings to enable ChatGPT drafts.' });
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-6-astra', instructions: SYSTEM_INSTRUCTIONS, input: prompt, max_output_tokens: config.length==='detailed'?300:220 })
      });
      const data = await upstream.json();
      if (!upstream.ok) return response.status(502).json({ error: 'ChatGPT could not create a draft. Check the API key and model access.' });
      caption = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return response.status(503).json({ error: 'Add GEMINI_API_KEY in the Vercel project settings to enable Gemini drafts.' });
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] }, contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: config.length==='detailed'?300:220, temperature: 0.4 } })
      });
      const data = await upstream.json();
      if (!upstream.ok) return response.status(502).json({ error: 'Gemini could not create a draft. Check the API key and model access.' });
      caption = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
    }

    if (!caption) return response.status(502).json({ error: 'The AI provider returned an empty draft.' });
    return response.status(200).json({ caption });
  } catch {
    return response.status(502).json({ error: 'The AI provider is temporarily unavailable.' });
  }
}
