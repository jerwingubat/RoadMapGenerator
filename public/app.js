class RoadmapGenerator {
	constructor() {
		this.form = document.getElementById('roadmap-form');
		this.output = document.getElementById('output');
		this.submitButton = this.form?.querySelector('.btn-primary');
		this.isGenerating = false;
		this.currentRoadmap = null;
		this.currentMetadata = null;
		
		this.init();
	}
	
	init() {
		if (!this.form || !this.output) {
			console.error('Required elements not found');
			return;
		}
		
		this.setupEventListeners();
		this.populateModels();
		this.setupFormValidation();
		this.setupAccessibility();
		this.setupSidebar();
		this.loadSavedRoadmaps();
	}
	
	setupEventListeners() {
		this.form.addEventListener('submit', this.handleSubmit.bind(this));
		
		const inputs = this.form.querySelectorAll('input, select');
		inputs.forEach(input => {
			input.addEventListener('blur', this.validateField.bind(this));
			input.addEventListener('input', this.clearFieldError.bind(this));
		});

		document.addEventListener('keydown', this.handleKeyboard.bind(this));
	}
	
	setupFormValidation() {
		const topicInput = document.getElementById('topic');
		if (topicInput) {
			topicInput.addEventListener('invalid', (e) => {
				e.target.setCustomValidity('Please enter a topic or role for your learning roadmap');
			});
			
			topicInput.addEventListener('input', (e) => {
				e.target.setCustomValidity('');
			});
		}
	}
	
	setupAccessibility() {
		const form = this.form;
		form.setAttribute('aria-label', 'Roadmap generation form');
		
		const announcer = document.createElement('div');
		announcer.setAttribute('aria-live', 'polite');
		announcer.setAttribute('aria-atomic', 'true');
		announcer.className = 'sr-only';
		document.body.appendChild(announcer);
		this.announcer = announcer;
	}
	
	setupSidebar() {
		const sidebar = document.getElementById('sidebar');
		const sidebarToggle = document.getElementById('sidebar-toggle');
		const sidebarClose = document.getElementById('sidebar-close');
		const sidebarOverlay = document.getElementById('sidebar-overlay');
		
		if (!sidebar || !sidebarToggle) return;
		
		sidebarToggle.addEventListener('click', () => {
			this.toggleSidebar();
		});
		
		if (sidebarClose) {
			sidebarClose.addEventListener('click', () => {
				this.closeSidebar();
			});
		}
		
		if (sidebarOverlay) {
			sidebarOverlay.addEventListener('click', () => {
				this.closeSidebar();
			});
		}
		
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && sidebar.classList.contains('open')) {
				this.closeSidebar();
			}
		});
	}
	
	toggleSidebar() {
		const sidebar = document.getElementById('sidebar');
		const sidebarToggle = document.getElementById('sidebar-toggle');
		
		if (!sidebar) return;
		
		const isOpen = sidebar.classList.contains('open');
		
		if (isOpen) {
			this.closeSidebar();
		} else {
			this.openSidebar();
		}
	}
	
	openSidebar() {
		const sidebar = document.getElementById('sidebar');
		const sidebarToggle = document.getElementById('sidebar-toggle');
		const body = document.body;
		
		if (!sidebar) return;
		
		sidebar.classList.add('open');
		if (sidebarToggle) {
			sidebarToggle.setAttribute('aria-expanded', 'true');
		}
		body.style.overflow = 'hidden';
	}
	
	closeSidebar() {
		const sidebar = document.getElementById('sidebar');
		const sidebarToggle = document.getElementById('sidebar-toggle');
		const body = document.body;
		
		if (!sidebar) return;
		
		sidebar.classList.remove('open');
		if (sidebarToggle) {
			sidebarToggle.setAttribute('aria-expanded', 'false');
		}
		body.style.overflow = '';
	}
	
	handleKeyboard(e) {
		if (e.key === 'Escape' && this.isGenerating) {
			this.cancelGeneration();
		}
	}
	
	async handleSubmit(e) {
		e.preventDefault();
		
		if (this.isGenerating) return;
		
		if (!this.validateForm()) {
			this.announce('Please fix the form errors before submitting');
			return;
		}
		
		const formData = this.getFormData();
		await this.generateRoadmap(formData);
	}
	
	validateForm() {
		const form = this.form;
		const isValid = form.checkValidity();
		
		if (!isValid) {
			const firstInvalid = form.querySelector(':invalid');
			if (firstInvalid) {
				firstInvalid.focus();
				firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
		
		return isValid;
	}
	
	validateField(e) {
		const field = e.target;
		const isValid = field.checkValidity();
		
		this.updateFieldState(field, isValid);
	}
	
	clearFieldError(e) {
		const field = e.target;
		this.updateFieldState(field, true);
	}
	
	updateFieldState(field, isValid) {
		const wrapper = field.closest('.field');
		if (!wrapper) return;
		
		wrapper.classList.toggle('field-error', !isValid);
		wrapper.classList.toggle('field-valid', isValid && field.value.trim());
		
		let errorElement = wrapper.querySelector('.field-error-message');
		if (!isValid && !errorElement) {
			errorElement = document.createElement('div');
			errorElement.className = 'field-error-message';
			errorElement.textContent = field.validationMessage;
			wrapper.appendChild(errorElement);
		} else if (isValid && errorElement) {
			errorElement.remove();
		}
	}
	
	getFormData() {
		const formData = new FormData(this.form);
		return {
			topic: formData.get('topic').trim(),
			level: formData.get('level'),
			timeframeWeeks: parseInt(formData.get('timeframe')) || 12,
			model: formData.get('model')
		};
	}
	
	async generateRoadmap(data) {
		this.isGenerating = true;
		this.setLoadingState(true);
		this.showOutput();
		this.announce('Starting roadmap generation...');
		
		try {
			const response = await this.makeRequest(data);
			
			if (!response.ok) {
				await this.handleError(response);
				return;
			}
			
			const result = await response.json();
			this.currentRoadmap = result;
			this.currentMetadata = {
				topic: data.topic,
				level: data.level,
				timeframeWeeks: data.timeframeWeeks,
				model: data.model
			};
			this.renderRoadmap(result);
			this.announce('Roadmap generated successfully');
			
			await this.saveRoadmap();
			
		} catch (error) {
			this.handleNetworkError(error);
		} finally {
			this.isGenerating = false;
			this.setLoadingState(false);
		}
	}
	
	async makeRequest(data) {
		const controller = new AbortController();
		this.abortController = controller;
		
		return fetch('/api/roadmap', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
			signal: controller.signal
		});
	}
	
	async handleError(response) {
		let errorMessage = `Error ${response.status}`;
		
		try {
			const errorData = await response.json();
			
			if (errorData.details) {
				const details = JSON.parse(errorData.details);
				if (details.error?.message) {
					errorMessage = details.error.message;
				}
			} else if (errorData.error) {
				errorMessage = errorData.error;
			}
		} catch {
			errorMessage = await response.text() || errorMessage;
		}
		
		this.renderError(errorMessage);
		this.announce(`Error: ${errorMessage}`);
	}
	
	handleNetworkError(error) {
		if (error.name === 'AbortError') {
			this.renderError('Generation cancelled');
			this.announce('Roadmap generation was cancelled');
		} else {
			this.renderError('Network error. Please check your connection and try again.');
			this.announce('Network error occurred');
		}
	}
	
	cancelGeneration() {
		if (this.abortController) {
			this.abortController.abort();
		}
	}
	
	setLoadingState(loading) {
		if (loading) {
			this.submitButton.classList.add('loading');
			this.submitButton.disabled = true;
			this.submitButton.setAttribute('aria-label', 'Generating roadmap, please wait');
		} else {
			this.submitButton.classList.remove('loading');
			this.submitButton.disabled = false;
			this.submitButton.setAttribute('aria-label', 'Generate roadmap');
		}
	}
	
	showOutput() {
		this.output.classList.remove('hidden');
		this.output.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	
	renderError(message) {
		this.output.innerHTML = `
			<div class="error-state">
				<div class="error-icon" aria-hidden="true">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<line x1="15" y1="9" x2="9" y2="15"/>
						<line x1="9" y1="9" x2="15" y2="15"/>
					</svg>
				</div>
				<h3 class="error-title">Something went wrong</h3>
				<p class="error-message">${this.escapeHtml(message)}</p>
				<button class="btn btn-secondary" onclick="roadmapGenerator.retryGeneration()">
					Try Again
				</button>
			</div>
		`;
	}
	
	renderRoadmap(data) {
	if (!data) {
			this.renderError('No data returned from the server');
		return;
	}

	if (data.raw) {
			this.output.innerHTML = `
				<div class="raw-output">
					<h3>Raw Output</h3>
					<pre class="raw-content">${this.escapeHtml(data.raw)}</pre>
				</div>
			`;
		return;
	}

	const { title, summary, total_estimated_hours, milestones } = data;
		const lastFormData = this.getFormData();

		let html = `
			<div class="roadmap-header">
				<div class="roadmap-header-top">
					<div>
						<h2 class="roadmap-title">${this.escapeHtml(title || 'Learning Roadmap')}</h2>
						${summary ? `<p class="roadmap-summary">${this.escapeHtml(summary)}</p>` : ''}
					</div>
					<div class="roadmap-actions"></div>
				</div>
				<div class="roadmap-meta">
					${total_estimated_hours ? `<span class="badge badge-primary">~${total_estimated_hours} hours total</span>` : ''}
					<span class="badge badge-secondary">${lastFormData.level} level</span>
					<span class="badge badge-secondary">${lastFormData.timeframeWeeks} weeks</span>
				</div>
			</div>
		`;

		if (Array.isArray(milestones) && milestones.length > 0) {
			html += '<div class="roadmap" role="list" aria-label="Learning milestones">';
			
			milestones.forEach((milestone, index) => {
				html += this.renderMilestone(milestone, index);
			});
			
			html += '</div>';
		} else {
			html += '<div class="no-milestones"><p>No milestones were generated. Please try again with a different topic.</p></div>';
		}

		this.output.innerHTML = html;
		this.setupRoadmapInteractions();
		this.addSaveButton();
	}
	
	renderMilestone(milestone, index) {
		const { name, goal, estimated_hours, prerequisites, steps } = milestone;
		
		let html = `
			<div class="roadmap-node" role="listitem" aria-labelledby="milestone-${index}">
				<div class="dot" aria-hidden="true"></div>
				<div class="roadmap-card">
					<h3 id="milestone-${index}" class="milestone-title">${this.escapeHtml(name || 'Milestone')}</h3>
					${goal ? `<div class="milestone-goal">${this.escapeHtml(goal)}</div>` : ''}
					
					<div class="milestone-meta">
						${estimated_hours ? `<span class="meta-item"><strong>Duration:</strong> ${estimated_hours}h</span>` : ''}
						${Array.isArray(prerequisites) && prerequisites.length > 0 ? 
							`<span class="meta-item"><strong>Prerequisites:</strong> ${this.escapeHtml(prerequisites.join(', '))}</span>` : ''}
					</div>
		`;

		if (Array.isArray(steps) && steps.length > 0) {
			html += '<div class="roadmap-steps" role="list" aria-label="Learning steps">';
			
			steps.forEach((step, stepIndex) => {
				html += this.renderStep(step, stepIndex);
			});
			
				html += '</div>';
			}

		html += '</div></div>';
		return html;
	}
	
	renderStep(step, stepIndex) {
		const { title, description, resources, deliverable } = step;
		
		let html = `
			<div class="roadmap-step" role="listitem">
				<h4 class="step-title">${this.escapeHtml(title || 'Step')}</h4>
				${description ? `<div class="step-description">${this.escapeHtml(description)}</div>` : ''}
		`;

		if (Array.isArray(resources) && resources.length > 0) {
			html += '<div class="step-resources">';
			html += '<h5 class="resources-title">Resources:</h5>';
			html += '<ul class="resources-list" role="list">';
			
			resources.forEach((resource, resourceIndex) => {
				const name = resource.name || resource.url || 'Resource';
				const url = resource.url || '#';
				html += `
					<li class="resource-item">
						<a href="${this.escapeHtml(url)}" 
						   class="resource-link" 
						   target="_blank" 
						   rel="noopener noreferrer"
						   aria-label="Open resource: ${this.escapeHtml(name)}">
							${this.escapeHtml(name)}
						</a>
					</li>
				`;
			});
			
			html += '</ul></div>';
		}

		if (deliverable) {
			html += `
				<div class="step-deliverable">
					<h5 class="deliverable-title">Deliverable:</h5>
					<p class="deliverable-content">${this.escapeHtml(deliverable)}</p>
				</div>
			`;
		}

			html += '</div>';
		return html;
	}
	
	setupRoadmapInteractions() {
		const stepTitles = this.output.querySelectorAll('.step-title');
		stepTitles.forEach(title => {
			title.style.cursor = 'pointer';
			title.setAttribute('tabindex', '0');
			title.setAttribute('role', 'button');
			title.setAttribute('aria-expanded', 'true');
			
			title.addEventListener('click', this.toggleStep.bind(this));
			title.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.toggleStep(e);
				}
			});
		});
		
		this.addCopyButton();
	}
	
	toggleStep(e) {
		const title = e.target;
		const step = title.closest('.roadmap-step');
		const content = step.querySelector('.step-description, .step-resources, .step-deliverable');
		
		if (!content) return;
		
		const isExpanded = title.getAttribute('aria-expanded') === 'true';
		title.setAttribute('aria-expanded', !isExpanded);
		
		if (isExpanded) {
			content.style.display = 'none';
			title.classList.add('collapsed');
		} else {
			content.style.display = 'block';
			title.classList.remove('collapsed');
		}
	}
	
	addCopyButton() {
		const actionsContainer = this.output.querySelector('.roadmap-actions');
		if (!actionsContainer) return;
		
		const copyButton = document.createElement('button');
		copyButton.type = 'button';
		copyButton.className = 'btn btn-secondary copy-button';
		copyButton.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
			</svg>
			Copy Roadmap
		`;
		
		copyButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.copyRoadmap();
		});
		actionsContainer.appendChild(copyButton);
	}
	
	addSaveButton() {
		const actionsContainer = this.output.querySelector('.roadmap-actions');
		if (!actionsContainer || !this.currentRoadmap) {
			console.log('Cannot add save button:', { actionsContainer: !!actionsContainer, currentRoadmap: !!this.currentRoadmap });
			return;
		}
		
		const existingButton = actionsContainer.querySelector('.save-button');
		if (existingButton) {
			console.log('Save button already exists');
			return;
		}
		
		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.className = 'btn btn-secondary save-button';
		saveButton.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
				<polyline points="17 21 17 13 7 13 7 21"/>
				<polyline points="7 3 7 8 15 8"/>
			</svg>
			Save Roadmap
		`;
		
		saveButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('Save button clicked');
			this.saveRoadmap(true);
		});
		
		actionsContainer.appendChild(saveButton);
		console.log('Save button added successfully');
	}
	
	async saveRoadmap(showFeedback = false) {
		if (!this.currentRoadmap) {
			console.error('Cannot save: no current roadmap');
			if (showFeedback) {
				this.announce('No roadmap to save');
			}
			return;
		}
		
		console.log('Saving roadmap:', { roadmap: !!this.currentRoadmap, metadata: !!this.currentMetadata });
		
		try {
			const response = await fetch('/api/roadmap/save', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					roadmap: this.currentRoadmap,
					metadata: this.currentMetadata
				})
			});
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error('Save failed:', response.status, errorText);
				throw new Error(`Failed to save roadmap: ${response.status}`);
			}
			
			const result = await response.json();
			console.log('Roadmap saved successfully:', result.id);
			this.savedRoadmapId = result.id;
			
			if (showFeedback) {
				const saveButton = this.output.querySelector('.save-button');
				if (saveButton) {
					const originalText = saveButton.innerHTML;
					saveButton.innerHTML = `
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M20 6L9 17l-5-5"/>
						</svg>
						Saved!
					`;
					saveButton.classList.add('saved');
					
					setTimeout(() => {
						saveButton.innerHTML = originalText;
						saveButton.classList.remove('saved');
					}, 2000);
				}
				this.announce('Roadmap saved successfully');
			}
			
			await this.loadSavedRoadmaps();
			
		} catch (error) {
			console.error('Error saving roadmap:', error);
			if (showFeedback) {
				this.announce(`Failed to save roadmap: ${error.message}`);
			}
		}
	}
	
	async loadSavedRoadmaps() {
		try {
			const response = await fetch('/api/roadmaps');
			if (!response.ok) return;
			
			const data = await response.json();
			this.renderSavedRoadmaps(data.roadmaps || []);
		} catch (error) {
			console.error('Error loading saved roadmaps:', error);
		}
	}
	
	renderSavedRoadmaps(roadmaps) {
		const sidebarBody = document.getElementById('sidebar-body');
		const sidebarBadge = document.getElementById('sidebar-badge');
		
		if (!sidebarBody) return;
		
		if (sidebarBadge) {
			sidebarBadge.textContent = roadmaps.length.toString();
			sidebarBadge.style.display = roadmaps.length > 0 ? 'flex' : 'none';
		}
		
		if (roadmaps.length === 0) {
			sidebarBody.innerHTML = `
				<div class="sidebar-empty-state">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
						<polyline points="14,2 14,8 20,8"/>
						<line x1="16" y1="13" x2="8" y2="13"/>
						<line x1="16" y1="17" x2="8" y2="17"/>
					</svg>
					<p>No saved roadmaps yet</p>
					<small>Generate a roadmap to get started</small>
				</div>
			`;
			return;
		}
		
		let html = '<div class="saved-roadmaps-list">';
		
		roadmaps.forEach(roadmap => {
			const date = new Date(roadmap.createdAt);
			const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			const timeframeWeeks =
				roadmap.timeframeWeeks ??
				(typeof roadmap.timeframeMonths === 'number' ? roadmap.timeframeMonths * 4 : null);
			
			html += `
				<div class="saved-roadmap-item" data-id="${this.escapeHtml(roadmap.id)}">
					<div class="saved-roadmap-info">
						<h4 class="saved-roadmap-title">${this.escapeHtml(roadmap.title)}</h4>
						<div class="saved-roadmap-meta">
							${roadmap.topic ? `<span class="meta-badge">${this.escapeHtml(roadmap.topic)}</span>` : ''}
							${roadmap.level ? `<span class="meta-badge">${this.escapeHtml(roadmap.level)}</span>` : ''}
							${timeframeWeeks ? `<span class="meta-badge">${timeframeWeeks} weeks</span>` : ''}
						</div>
						<small class="saved-roadmap-date">Saved on ${dateStr}</small>
					</div>
					<div class="saved-roadmap-actions">
						<button class="btn btn-small btn-primary load-roadmap-btn" data-id="${this.escapeHtml(roadmap.id)}">
							Load
						</button>
						<button class="btn btn-small btn-secondary delete-roadmap-btn" data-id="${this.escapeHtml(roadmap.id)}">
							Delete
						</button>
					</div>
				</div>
			`;
		});
		
		html += '</div>';
		sidebarBody.innerHTML = html;
		
		sidebarBody.querySelectorAll('.load-roadmap-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const id = btn.getAttribute('data-id');
				this.loadRoadmap(id);
				this.closeSidebar();
			});
		});
		
		sidebarBody.querySelectorAll('.delete-roadmap-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const id = btn.getAttribute('data-id');
				this.deleteRoadmap(id);
			});
		});
	}
	
	async loadRoadmap(id) {
		try {
			const response = await fetch(`/api/roadmap/${id}`);
			if (!response.ok) {
				throw new Error('Failed to load roadmap');
			}
			
			const data = await response.json();
			this.currentRoadmap = data.roadmap;
			this.currentMetadata = data.metadata || {};
			this.savedRoadmapId = data.id;
			
			this.renderRoadmap(data.roadmap);
			this.showOutput();
			this.announce('Roadmap loaded successfully');
			
			this.closeSidebar();
			
			window.scrollTo({ top: 0, behavior: 'smooth' });
			
		} catch (error) {
			console.error('Error loading roadmap:', error);
			this.announce('Failed to load roadmap');
		}
	}
	
	async deleteRoadmap(id) {
		if (!confirm('Are you sure you want to delete this roadmap?')) {
			return;
		}
		
		try {
			const response = await fetch(`/api/roadmap/${id}`, {
				method: 'DELETE'
			});
			
			if (!response.ok) {
				throw new Error('Failed to delete roadmap');
			}
			
			this.announce('Roadmap deleted successfully');
			await this.loadSavedRoadmaps();
			
		} catch (error) {
			console.error('Error deleting roadmap:', error);
			this.announce('Failed to delete roadmap');
		}
	}
	
	async copyRoadmap() {
		try {
			const roadmapText = this.extractRoadmapText();
			await navigator.clipboard.writeText(roadmapText);
			
			const button = this.output.querySelector('.copy-button');
			const originalText = button.innerHTML;
			button.innerHTML = `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M20 6L9 17l-5-5"/>
				</svg>
				Copied!
			`;
			button.classList.add('copied');
			
			setTimeout(() => {
				button.innerHTML = originalText;
				button.classList.remove('copied');
			}, 2000);
			
			this.announce('Roadmap copied to clipboard');
		} catch (error) {
			console.error('Failed to copy roadmap:', error);
			this.announce('Failed to copy roadmap');
		}
	}
	
	extractRoadmapText() {
		const title = this.output.querySelector('.roadmap-title')?.textContent || 'Learning Roadmap';
		const summary = this.output.querySelector('.roadmap-summary')?.textContent || '';
		const milestones = this.output.querySelectorAll('.roadmap-node');
		
		let text = `${title}\n\n`;
		if (summary) text += `${summary}\n\n`;
		
		milestones.forEach((milestone, index) => {
			const milestoneTitle = milestone.querySelector('.milestone-title')?.textContent || `Milestone ${index + 1}`;
			const goal = milestone.querySelector('.milestone-goal')?.textContent || '';
			const steps = milestone.querySelectorAll('.roadmap-step');
			
			text += `${index + 1}. ${milestoneTitle}\n`;
			if (goal) text += `   ${goal}\n`;
			
			steps.forEach((step, stepIndex) => {
				const stepTitle = step.querySelector('.step-title')?.textContent || `Step ${stepIndex + 1}`;
				const description = step.querySelector('.step-description')?.textContent || '';
				const deliverable = step.querySelector('.deliverable-content')?.textContent || '';
				
				text += `   ${stepIndex + 1}. ${stepTitle}\n`;
				if (description) text += `      ${description}\n`;
				if (deliverable) text += `      Deliverable: ${deliverable}\n`;
			});
			
			text += '\n';
		});
		
		return text;
	}
	
	retryGeneration() {
		const formData = this.getFormData();
		this.generateRoadmap(formData);
	}
	
	announce(message) {
		if (this.announcer) {
			this.announcer.textContent = message;
		}
	}
	
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
	
	async populateModels() {
		const select = document.getElementById('model');
		if (!select) return;
		
		try {
			const response = await fetch('/api/models');
			if (!response.ok) throw new Error('Failed to fetch models');
			
			const data = await response.json();
			const models = data.models || [];
			
			select.innerHTML = '';
			
			if (models.length === 0) {
				this.populateFallbackModels();
				return;
			}
			
			models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.id;
				const displayName = model.name || this.formatModelName(model.id);
				option.textContent = displayName;
				select.appendChild(option);
			});
			
			if (models.length > 0) {
				select.value = models[0].id;
			}
			
		} catch (error) {
			console.error('Failed to populate models:', error);
			this.populateFallbackModels();
		}
	}
	
	formatModelName(modelId) {
		if (!modelId) return modelId;
		
		let name = modelId.replace(/:free$/, '');
		
		const parts = name.split('/');
		name = parts[parts.length - 1];
		
		name = name
			.replace(/-/g, ' ')
			.replace(/\b\w/g, l => l.toUpperCase());
		
		name = name.replace(/\s+v?\d{4,}/g, '');
		
		return name;
	}
	
	populateFallbackModels() {
	const select = document.getElementById('model');
	if (!select) return;
		
		const fallbackModels = [
			{ id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek Chat v3 (Recommended)' },
			{ id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick' },
			{ id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1' }
		];
		
	select.innerHTML = '';
		fallbackModels.forEach(model => {
			const option = document.createElement('option');
			option.value = model.id;
			option.textContent = model.name;
			select.appendChild(option);
		});
		
		select.value = fallbackModels[0].id;
	}
}

// Utility functions
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

function throttle(func, limit) {
	let inThrottle;
	return function() {
		const args = arguments;
		const context = this;
		if (!inThrottle) {
			func.apply(context, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

let roadmapGenerator;

document.addEventListener('DOMContentLoaded', () => {
	roadmapGenerator = new RoadmapGenerator();
	
	document.querySelectorAll('a[href^="#"]').forEach(anchor => {
		anchor.addEventListener('click', function (e) {
	e.preventDefault();
			const target = document.querySelector(this.getAttribute('href'));
			if (target) {
				target.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
			}
		});
	});
	
	const observerOptions = {
		threshold: 0.1,
		rootMargin: '0px 0px -50px 0px'
	};
	
	const observer = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('animate-in');
			}
		});
	}, observerOptions);
	
	document.querySelectorAll('.feature-card, .roadmap-node').forEach(el => {
		observer.observe(el);
	});
});

document.addEventListener('visibilitychange', () => {
	if (document.hidden && roadmapGenerator?.isGenerating) {
		console.log('Page hidden during generation');
	}
});

window.addEventListener('online', () => {
	console.log('Connection restored');
});

window.addEventListener('offline', () => {
	console.log('Connection lost');
	if (roadmapGenerator?.isGenerating) {
		roadmapGenerator.handleNetworkError(new Error('Connection lost'));
	}
});

window.roadmapGenerator = roadmapGenerator; 