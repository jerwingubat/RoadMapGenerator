require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Polyfill fetch if not available
const fetchFn = (typeof fetch !== 'undefined')
	? fetch
	: ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
	console.warn('Warning: OPENROUTER_API_KEY is not set. Set it in .env');
}

// Reference-style constants
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_INTERVAL = 1000; // ms
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000];
const MODELS = [
	'deepseek/deepseek-r1:free',
	'google/gemini-2.5-flash-preview'
];

app.get('/api/models', async (_req, res) => {
	try {
		const response = await fetchFn('https://openrouter.ai/api/v1/models', {
			headers: {
				'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
				'HTTP-Referer': process.env.APP_URL || `http://localhost:${port}`,
				'X-Title': 'AI Roadmap Generator'
			}
		});
		if (!response.ok) {
			const text = await response.text();
			return res.status(502).json({ error: 'Upstream error', details: text });
		}
		const data = await response.json();
		const models = (data?.data || []).map(m => ({ id: m?.id, name: m?.name || m?.id, pricing: m?.pricing || {}, context_length: m?.context_length })).filter(m => m.id);
		return res.json({ models });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

async function callOpenRouterChat(modelId, systemPrompt, userPrompt) {
	const response = await fetchFn(API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': process.env.APP_URL || `http://localhost:${port}`,
			'X-Title': 'AI Roadmap Generator'
		},
		body: JSON.stringify({
			model: modelId,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			temperature: 0.7,
			response_format: { type: 'json_object' }
		})
	});
	return response;
}

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function tryExtractJson(text) {
	if (typeof text !== 'string') return null;
	// Try fenced code block ```json ... ``` first
	const fenceMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
	if (fenceMatch && fenceMatch[1]) {
		try { return JSON.parse(fenceMatch[1]); } catch {}
	}
	// Fallback: find first { and last } and attempt parse
	const first = text.indexOf('{');
	const last = text.lastIndexOf('}');
	if (first !== -1 && last !== -1 && last > first) {
		const candidate = text.slice(first, last + 1);
		try { return JSON.parse(candidate); } catch {}
	}
	return null;
}

let lastRequestAt = 0;

app.post('/api/roadmap', async (req, res) => {
	try {
		const { topic, level = 'beginner', timeframeMonths = 3, model } = req.body || {};
		if (!topic) {
			return res.status(400).json({ error: 'Missing required field: topic' });
		}

		// Simple throttle per server instance
		const now = Date.now();
		const elapsed = now - lastRequestAt;
		if (elapsed < REQUEST_INTERVAL) {
			await wait(REQUEST_INTERVAL - elapsed);
		}
		lastRequestAt = Date.now();

		const systemPrompt = `You are an expert curriculum designer. Create a practical, step-by-step learning roadmap. The roadmap must be actionable with milestones, resources, estimated time, and deliverables. Return ONLY valid JSON. Do not include markdown or code fences.`;

		const userPrompt = `Generate a learning roadmap similar to roadmap.sh for the following:\nTopic: ${topic}\nStarting level: ${level}\nTimeframe (months): ${timeframeMonths}\n\nOutput JSON with this structure:\n{\n  \"title\": string,\n  \"summary\": string,\n  \"total_estimated_hours\": number,\n  \"milestones\": [\n    {\n      \"name\": string,\n      \"goal\": string,\n      \"estimated_hours\": number,\n      \"prerequisites\": string[],\n      \"steps\": [\n        {\n          \"title\": string,\n          \"description\": string,\n          \"resources\": [ { \"name\": string, \"url\": string } ],\n          \"deliverable\": string\n        }\n      ]\n    }\n  ]\n}`;

		// Build candidate order: requested model first (if given), then MODELS order
		const preferred = [];
		if (model) preferred.push(model);
		for (const m of MODELS) {
			if (!preferred.includes(m)) preferred.push(m);
		}

		let lastErrorText = '';
		for (const candidate of preferred) {
			for (let attempt = 0; attempt < Math.min(MAX_RETRIES, RETRY_DELAYS.length); attempt++) {
				if (attempt > 0) await wait(RETRY_DELAYS[attempt]);
				const response = await callOpenRouterChat(candidate, systemPrompt, userPrompt);
				if (response.ok) {
					const data = await response.json();
					const content = data?.choices?.[0]?.message?.content || '';
					try {
						const parsed = JSON.parse(content);
						return res.json(parsed);
					} catch {}
					const extracted = tryExtractJson(content);
					if (extracted) return res.json(extracted);
					return res.status(200).json({ raw: content });
				}
				const text = await response.text();
				lastErrorText = text;
				// If 429/404 from provider, break to next model candidate
				if (response.status === 429 || response.status === 404) break;
			}
		}

		return res.status(502).json({ error: 'Upstream error', details: lastErrorText || 'No candidate models succeeded' });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
}); 