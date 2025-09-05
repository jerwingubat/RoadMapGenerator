const form = document.getElementById('roadmap-form');
const output = document.getElementById('output');

function renderError(message) {
	output.classList.remove('hidden');
	output.innerHTML = `<div class="error">${message}</div>`;
}

function renderRoadmap(data) {
	output.classList.remove('hidden');
	if (!data) {
		output.innerHTML = '<p>No data returned.</p>';
		return;
	}

	if (data.raw) {
		output.innerHTML = `<pre>${data.raw.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>`;
		return;
	}

	const { title, summary, total_estimated_hours, milestones } = data;

	let html = '';
	html += `<h2>${title || 'Roadmap'}</h2>`;
	if (summary) html += `<p class="summary">${summary}</p>`;
	if (total_estimated_hours) html += `<p class="meta"><span class="badge">Total ~${total_estimated_hours}h</span></p>`;

	// Visual roadmap
	html += '<div class="roadmap">';
	if (Array.isArray(milestones)) {
		for (const m of milestones) {
			html += '<div class="roadmap-node">';
			html += '<div class="dot"></div>';
			html += '<div class="roadmap-card">';
			html += `<h3>${m.name || 'Milestone'}</h3>`;
			if (m.goal) html += `<div class="goal">${m.goal}</div>`;
			const metaParts = [];
			if (m.estimated_hours) metaParts.push(`${m.estimated_hours}h`);
			if (Array.isArray(m.prerequisites) && m.prerequisites.length) metaParts.push(`Prereq: ${m.prerequisites.join(', ')}`);
			if (metaParts.length) html += `<p class="meta">${metaParts.join(' • ')}</p>`;

			if (Array.isArray(m.steps) && m.steps.length) {
				html += '<div class="roadmap-steps">';
				for (const s of m.steps) {
					html += '<div class="roadmap-step">';
					html += `<div class="roadmap-step-title">${s.title || 'Step'}</div>`;
					if (s.description) html += `<div class="desc">${s.description}</div>`;
					if (Array.isArray(s.resources) && s.resources.length) {
						html += '<div class="resources"><strong>Resources:</strong><ul>';
						for (const r of s.resources) {
							const name = r.name || r.url || 'Resource';
							const url = r.url || '#';
							html += `<li><a class="link" href="${url}" target="_blank" rel="noopener">${name}</a></li>`;
						}
						html += '</ul></div>';
					}
					if (s.deliverable) html += `<div class="deliverable"><strong>Deliverable:</strong> ${s.deliverable}</div>`;
					html += '</div>';
				}
				html += '</div>';
			}

			html += '</div>'; // roadmap-card
			html += '</div>'; // roadmap-node
		}
	}
	html += '</div>'; // roadmap

	output.innerHTML = html;
}

async function populateModels() {
	const select = document.getElementById('model');
	if (!select) return;
	try {
		const res = await fetch('/api/models');
		if (!res.ok) return;
		const { models } = await res.json();
		select.innerHTML = '';
		const preferred = ['deepseek/deepseek-r1:free', 'google/gemini-2.5-flash-preview'];
		const sorted = models.sort((a,b) => preferred.indexOf(a.id) - preferred.indexOf(b.id));
		for (const m of sorted) {
			const opt = document.createElement('option');
			opt.value = m.id;
			opt.textContent = m.id;
			select.appendChild(opt);
		}
		const deepseekOpt = Array.from(select.options).find(o => o.value === 'deepseek/deepseek-r1:free');
		if (deepseekOpt) select.value = 'deepseek/deepseek-r1:free';
	} catch {}
}

populateModels();

form.addEventListener('submit', async (e) => {
	e.preventDefault();
	const topic = document.getElementById('topic').value.trim();
	const level = document.getElementById('level').value;
	const timeframeMonths = Number(document.getElementById('timeframe').value) || 3;
	const model = document.getElementById('model').value;

	output.classList.remove('hidden');
	output.innerHTML = '<div class="loading">Generating roadmap…</div>';

	try {
		const res = await fetch('/api/roadmap', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ topic, level, timeframeMonths, model })
		});

		if (!res.ok) {
			const text = await res.text();
			return renderError(`Error ${res.status}: ${text}`);
		}

		const data = await res.json();
		renderRoadmap(data);
	} catch (err) {
		renderError('Network error. Please try again.');
	}
}); 