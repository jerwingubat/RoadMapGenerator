const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000];
const MODELS = [
	'deepseek/deepseek-chat-v3-0324:free',
	'meta-llama/llama-4-maverick:free',
	'deepseek/deepseek-r1:free',
	'qwen/qwen3-235b-a22b:free'
];


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

async function callOpenRouterChat(modelId, systemPrompt, userPrompt, req) {
	const referer = process.env.APP_URL || (req && (req.headers['x-forwarded-host'] ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host']}` : req.headers.origin)) || 'http://localhost:3000';
	const response = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': referer,
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

module.exports = {
	API_URL,
	MAX_RETRIES,
	RETRY_DELAYS,
	MODELS,
	wait,
	tryExtractJson,
	callOpenRouterChat,
}; 