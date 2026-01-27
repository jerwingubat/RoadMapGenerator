const { MAX_RETRIES, RETRY_DELAYS, MODELS, wait, tryExtractJson, callOpenRouterChat } = require('./_common');

module.exports = async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	try {
		const { topic, level = 'beginner', timeframeWeeks, timeframeMonths, model } = req.body || {};
		if (!topic) return res.status(400).json({ error: 'Missing required field: topic' });
		const weeks = Number.isFinite(Number(timeframeWeeks))
			? Math.max(1, Math.min(52, Number(timeframeWeeks)))
			: (Number.isFinite(Number(timeframeMonths)) ? Math.max(1, Math.min(52, Number(timeframeMonths) * 4)) : 12);

		const systemPrompt = `You are an expert curriculum designer. Create a practical, step-by-step learning roadmap. The roadmap must be actionable with weekly milestones, resources, estimated time, and deliverables. Return ONLY valid JSON. Do not include markdown or code fences.`;
		const userPrompt = `Generate a learning roadmap similar to roadmap.sh for the following:\nTopic: ${topic}\nStarting level: ${level}\nTimeframe (weeks): ${weeks}\n\nIMPORTANT:\n- The roadmap must be organized PER WEEK.\n- The \"milestones\" array must have exactly ${weeks} items, one per week.\n- Each milestone name should start with \"Week X\" (e.g., \"Week 1: ...\").\n- Estimated hours should be for that week.\n\nOutput JSON with this structure:\n{\n  \"title\": string,\n  \"summary\": string,\n  \"total_estimated_hours\": number,\n  \"milestones\": [\n    {\n      \"name\": string,\n      \"goal\": string,\n      \"estimated_hours\": number,\n      \"prerequisites\": string[],\n      \"steps\": [\n        {\n          \"title\": string,\n          \"description\": string,\n          \"resources\": [ { \"name\": string, \"url\": string } ],\n          \"deliverable\": string\n        }\n      ]\n    }\n  ]\n}`;

		let available = [];
		try {
			const resp = await fetch('https://openrouter.ai/api/v1/models', {
				headers: {
					'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
					'HTTP-Referer': process.env.APP_URL || (req.headers.origin || ''),
					'X-Title': 'AI Roadmap Generator'
				}
			});
			if (resp.ok) {
				const list = await resp.json();
				available = (list?.data || []).map(m => m?.id).filter(Boolean);
			}
		} catch {}

		const preferredRaw = [];
		if (model) preferredRaw.push(model);
		for (const m of MODELS) if (!preferredRaw.includes(m)) preferredRaw.push(m);
		const preferred = preferredRaw.filter(m => available.length === 0 || available.includes(m));
		if (preferred.length === 0) preferred.push('deepseek/deepseek-r1:free');

		let lastErrorText = '';
		for (const candidate of preferred) {
			for (let attempt = 0; attempt < Math.min(MAX_RETRIES, RETRY_DELAYS.length); attempt++) {
				if (attempt > 0) await wait(RETRY_DELAYS[attempt]);
				const response = await callOpenRouterChat(candidate, systemPrompt, userPrompt, req);
				if (response.ok) {
					const data = await response.json();
					const content = data?.choices?.[0]?.message?.content || '';
					try { return res.status(200).json(JSON.parse(content)); } catch {}
					const extracted = tryExtractJson(content);
					if (extracted) return res.status(200).json(extracted);
					return res.status(200).json({ raw: content });
				}
				const text = await response.text();
				lastErrorText = text;
				if (response.status === 429 || response.status === 404) break;
			}
		}

		return res.status(502).json({ error: 'Upstream error', details: lastErrorText || 'No candidate models succeeded' });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
} 