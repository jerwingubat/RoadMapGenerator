const fs = require('fs').promises;
const path = require('path');

const STORAGE_DIR = path.join(process.cwd(), 'data');
const ROADMAPS_FILE = path.join(STORAGE_DIR, 'roadmaps.json');

async function ensureStorageDir() {
	try {
		await fs.mkdir(STORAGE_DIR, { recursive: true });
	} catch (err) {
		console.error('Failed to create storage directory:', err);
	}
}

async function loadRoadmaps() {
	try {
		await ensureStorageDir();
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

module.exports = async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const { roadmap, metadata } = req.body || {};
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
