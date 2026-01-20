const { loadRoadmaps, saveRoadmaps } = require('../_storage');

module.exports = async function handler(req, res) {
	// Extract ID from query params (Vercel dynamic routes) or URL path
	let id = req.query?.id;
	
	// If not in query, try to extract from URL
	if (!id && req.url) {
		const match = req.url.match(/\/api\/roadmap\/([^/?]+)/);
		if (match) {
			id = match[1];
		}
	}

	if (!id) {
		return res.status(400).json({ error: 'Missing roadmap ID' });
	}

	try {
		if (req.method === 'GET') {
			const roadmaps = await loadRoadmaps();
			const roadmap = roadmaps.find(r => r.id === id);
			
			if (!roadmap) {
				return res.status(404).json({ error: 'Roadmap not found' });
			}

			return res.status(200).json(roadmap);
		} else if (req.method === 'DELETE') {
			const roadmaps = await loadRoadmaps();
			const filtered = roadmaps.filter(r => r.id !== id);
			
			if (filtered.length === roadmaps.length) {
				return res.status(404).json({ error: 'Roadmap not found' });
			}

			await saveRoadmaps(filtered);
			return res.status(200).json({ success: true });
		} else {
			return res.status(405).json({ error: 'Method not allowed' });
		}
	} catch (err) {
		console.error('Error processing roadmap:', err);
		return res.status(500).json({ error: 'Failed to process roadmap' });
	}
};
