const { loadRoadmaps } = require('./_storage');

module.exports = async function handler(req, res) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const roadmaps = await loadRoadmaps();
		const list = roadmaps.map(r => ({
			id: r.id,
			title: r.roadmap?.title || r.metadata?.topic || 'Untitled Roadmap',
			topic: r.metadata?.topic || '',
			level: r.metadata?.level || '',
			timeframeWeeks:
				r.metadata?.timeframeWeeks ??
				(typeof r.metadata?.timeframeMonths === 'number' ? r.metadata.timeframeMonths * 4 : 12),
			createdAt: r.createdAt,
			updatedAt: r.updatedAt
		}));
		return res.status(200).json({ roadmaps: list.reverse() });
	} catch (err) {
		console.error('Error loading roadmaps:', err);
		return res.status(500).json({ error: 'Failed to load roadmaps' });
	}
};
