const { API_URL } = require('./_common');

export default async function handler(req, res) {
	try {
		const response = await fetch('https://openrouter.ai/api/v1/models', {
			headers: {
				'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
				'HTTP-Referer': process.env.APP_URL || (req.headers.origin || ''),
				'X-Title': 'AI Roadmap Generator'
			}
		});
		if (!response.ok) {
			const text = await response.text();
			return res.status(502).json({ error: 'Upstream error', details: text });
		}
		const data = await response.json();
		const models = (data?.data || []).map(m => ({ id: m?.id, name: m?.name || m?.id, pricing: m?.pricing || {}, context_length: m?.context_length })).filter(m => m.id);
		return res.status(200).json({ models });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
} 