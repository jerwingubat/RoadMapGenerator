const { loadRoadmaps, saveRoadmaps } = require('../_storage');

module.exports = async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

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

		return res.status(200).json({ success: true, id: newRoadmap.id, roadmap: newRoadmap });
	} catch (err) {
		console.error('Error saving roadmap:', err);
		return res.status(500).json({ error: 'Failed to save roadmap' });
	}
};
