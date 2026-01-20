const fs = require('fs').promises;
const path = require('path');

// For Vercel serverless functions, use /tmp directory (writable)
// For local development, use data directory
const STORAGE_DIR = process.env.VERCEL 
	? '/tmp'
	: path.join(process.cwd(), 'data');
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

module.exports = {
	loadRoadmaps,
	saveRoadmaps
};
