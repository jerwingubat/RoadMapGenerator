require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Storage directory for saved roadmaps
const STORAGE_DIR = path.join(__dirname, '..', 'data');
const ROADMAPS_FILE = path.join(STORAGE_DIR, 'roadmaps.json');

const fetchFn = (typeof fetch !== 'undefined')
	? fetch
	: ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure storage directory exists
async function ensureStorageDir() {
	try {
		await fs.mkdir(STORAGE_DIR, { recursive: true });
	} catch (err) {
		console.error('Failed to create storage directory:', err);
	}
}

// Initialize storage on startup
ensureStorageDir();

// Helper functions for roadmap storage
async function loadRoadmaps() {
	try {
		const data = await fs.readFile(ROADMAPS_FILE, 'utf8');
		return JSON.parse(data);
	} catch (err) {
		if (err.code === 'ENOENT') {
			return [];
		}
		throw err;
	}
}

async function saveRoadmaps(roadmaps) {
	await ensureStorageDir();
	await fs.writeFile(ROADMAPS_FILE, JSON.stringify(roadmaps, null, 2), 'utf8');
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
	console.warn('Warning: OPENROUTER_API_KEY is not set. Set it in .env');
}

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_INTERVAL = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000];
const MODELS = [
	'deepseek/deepseek-chat-v3-0324:free',
	'meta-llama/llama-4-maverick:free',
	'deepseek/deepseek-r1:free'
];

function isRateLimitError(errorText) {
	try {
		const error = JSON.parse(errorText);
		return error.error && error.error.code === 429;
	} catch {
		return false;
	}
}

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
		
		// Filter for free models only (models with :free in ID or pricing that indicates free)
		const freeModels = (data?.data || [])
			.filter(m => {
				// Check if model ID contains :free
				if (m?.id && m.id.includes(':free')) return true;
				// Check if pricing indicates free (prompt and completion prices are 0 or null)
				const pricing = m?.pricing || {};
				const promptPrice = pricing.prompt || 0;
				const completionPrice = pricing.completion || 0;
				return promptPrice === 0 && completionPrice === 0;
			})
			.map(m => ({ 
				id: m?.id, 
				name: m?.name || m?.id, 
				pricing: m?.pricing || {}, 
				context_length: m?.context_length 
			}))
			.filter(m => m.id);
		
		return res.json({ models: freeModels });
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
	const fenceMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
	if (fenceMatch && fenceMatch[1]) {
		try { return JSON.parse(fenceMatch[1]); } catch {}
	}
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

		const now = Date.now();
		const elapsed = now - lastRequestAt;
		if (elapsed < REQUEST_INTERVAL) {
			await wait(REQUEST_INTERVAL - elapsed);
		}
		lastRequestAt = Date.now();

		const systemPrompt = `You are an expert curriculum designer. Create a practical, step-by-step learning roadmap. The roadmap must be actionable with milestones, resources, estimated time, and deliverables. Return ONLY valid JSON. Do not include markdown or code fences.`;

		const userPrompt = `Generate a learning roadmap similar to roadmap.sh for the following:\nTopic: ${topic}\nStarting level: ${level}\nTimeframe (months): ${timeframeMonths}\n\nOutput JSON with this structure:\n{\n  \"title\": string,\n  \"summary\": string,\n  \"total_estimated_hours\": number,\n  \"milestones\": [\n    {\n      \"name\": string,\n      \"goal\": string,\n      \"estimated_hours\": number,\n      \"prerequisites\": string[],\n      \"steps\": [\n        {\n          \"title\": string,\n          \"description\": string,\n          \"resources\": [ { \"name\": string, \"url\": string } ],\n          \"deliverable\": string\n        }\n      ]\n    }\n  ]\n}`;

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
				if (response.status === 429 || response.status === 404) break;
			}
		}

		return res.status(502).json({ error: 'Upstream error', details: lastErrorText || 'No candidate models succeeded' });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// Save roadmap endpoint
app.post('/api/roadmap/save', async (req, res) => {
	try {
		const { roadmap, metadata } = req.body;
		if (!roadmap) {
			return res.status(400).json({ error: 'Missing roadmap data' });
		}

		const roadmaps = await loadRoadmaps();
		const newRoadmap = {
			id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
			roadmap,
			metadata: metadata || {},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		roadmaps.push(newRoadmap);
		await saveRoadmaps(roadmaps);

		return res.json({ success: true, id: newRoadmap.id, roadmap: newRoadmap });
	} catch (err) {
		console.error('Error saving roadmap:', err);
		return res.status(500).json({ error: 'Failed to save roadmap' });
	}
});

// Get all saved roadmaps
app.get('/api/roadmaps', async (_req, res) => {
	try {
		const roadmaps = await loadRoadmaps();
		// Return only metadata for list view
		const list = roadmaps.map(r => ({
			id: r.id,
			title: r.roadmap?.title || r.metadata?.topic || 'Untitled Roadmap',
			topic: r.metadata?.topic || '',
			level: r.metadata?.level || '',
			timeframeMonths: r.metadata?.timeframeMonths || 3,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt
		}));
		return res.json({ roadmaps: list.reverse() }); // Most recent first
	} catch (err) {
		console.error('Error loading roadmaps:', err);
		return res.status(500).json({ error: 'Failed to load roadmaps' });
	}
});

// Get a specific roadmap
app.get('/api/roadmap/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const roadmaps = await loadRoadmaps();
		const roadmap = roadmaps.find(r => r.id === id);
		
		if (!roadmap) {
			return res.status(404).json({ error: 'Roadmap not found' });
		}

		return res.json(roadmap);
	} catch (err) {
		console.error('Error loading roadmap:', err);
		return res.status(500).json({ error: 'Failed to load roadmap' });
	}
});

// Delete a roadmap
app.delete('/api/roadmap/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const roadmaps = await loadRoadmaps();
		const filtered = roadmaps.filter(r => r.id !== id);
		
		if (filtered.length === roadmaps.length) {
			return res.status(404).json({ error: 'Roadmap not found' });
		}

		await saveRoadmaps(filtered);
		return res.json({ success: true });
	} catch (err) {
		console.error('Error deleting roadmap:', err);
		return res.status(500).json({ error: 'Failed to delete roadmap' });
	}
});

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
}); 