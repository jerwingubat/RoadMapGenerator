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
	const { id } = req.query;

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
