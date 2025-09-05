// Enhanced JavaScript with senior-level practices
class RoadmapGenerator {
	constructor() {
		this.form = document.getElementById('roadmap-form');
		this.output = document.getElementById('output');
		this.submitButton = this.form?.querySelector('.btn-primary');
		this.isGenerating = false;
		
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
	}
	
	setupEventListeners() {
		this.form.addEventListener('submit', this.handleSubmit.bind(this));
		
		// Real-time validation
		const inputs = this.form.querySelectorAll('input, select');
		inputs.forEach(input => {
			input.addEventListener('blur', this.validateField.bind(this));
			input.addEventListener('input', this.clearFieldError.bind(this));
		});
		
		// Keyboard navigation
		document.addEventListener('keydown', this.handleKeyboard.bind(this));
	}
	
	setupFormValidation() {
		// Add custom validation messages
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
		// Add ARIA labels and descriptions
		const form = this.form;
		form.setAttribute('aria-label', 'Roadmap generation form');
		
		// Announce form state changes
		const announcer = document.createElement('div');
		announcer.setAttribute('aria-live', 'polite');
		announcer.setAttribute('aria-atomic', 'true');
		announcer.className = 'sr-only';
		document.body.appendChild(announcer);
		this.announcer = announcer;
	}
	
	handleKeyboard(e) {
		// Escape key to cancel generation
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
			// Focus first invalid field
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
		
		// Add/remove error message
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
			timeframeMonths: parseInt(formData.get('timeframe')) || 3,
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
			this.renderRoadmap(result);
			this.announce('Roadmap generated successfully');
			
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
				<h2 class="roadmap-title">${this.escapeHtml(title || 'Learning Roadmap')}</h2>
				${summary ? `<p class="roadmap-summary">${this.escapeHtml(summary)}</p>` : ''}
				<div class="roadmap-meta">
					${total_estimated_hours ? `<span class="badge badge-primary">~${total_estimated_hours} hours total</span>` : ''}
					<span class="badge badge-secondary">${lastFormData.level} level</span>
					<span class="badge badge-secondary">${lastFormData.timeframeMonths} months</span>
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
		// Add expand/collapse functionality for steps
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
		
		// Add copy functionality for the entire roadmap
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
		const roadmapHeader = this.output.querySelector('.roadmap-header');
		if (!roadmapHeader) return;
		
		const copyButton = document.createElement('button');
		copyButton.className = 'btn btn-secondary copy-button';
		copyButton.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
			</svg>
			Copy Roadmap
		`;
		
		copyButton.addEventListener('click', this.copyRoadmap.bind(this));
		roadmapHeader.appendChild(copyButton);
	}
	
	async copyRoadmap() {
		try {
			const roadmapText = this.extractRoadmapText();
			await navigator.clipboard.writeText(roadmapText);
			
			// Show success feedback
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
			
			// Clear existing options
			select.innerHTML = '';
			
			// Add models with better display names
			const modelMap = {
				'deepseek/deepseek-chat-v3-0324:free': 'DeepSeek Chat v3 (Recommended)',
				'meta-llama/llama-4-maverick:free': 'Llama 4 Maverick',
				'deepseek/deepseek-r1:free': 'DeepSeek R1',
				'qwen/qwen3-235b-a22b:free': 'Qwen 3 235B'
			};
			
			// Add available models
			models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = modelMap[model.id] || model.name || model.id;
				select.appendChild(option);
			});
			
			// Set default selection
			if (models.length > 0) {
				select.value = models[0].id;
			}
			
		} catch (error) {
			console.error('Failed to populate models:', error);
			// Fallback to hardcoded models
			this.populateFallbackModels();
		}
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

// Initialize the application
let roadmapGenerator;

document.addEventListener('DOMContentLoaded', () => {
	roadmapGenerator = new RoadmapGenerator();
	
	// Add smooth scrolling for anchor links
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
	
	// Add intersection observer for animations
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
	
	// Observe elements for animation
	document.querySelectorAll('.feature-card, .roadmap-node').forEach(el => {
		observer.observe(el);
	});
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
	if (document.hidden && roadmapGenerator?.isGenerating) {
		// Optionally pause or cancel generation when page is hidden
		console.log('Page hidden during generation');
	}
});

// Handle online/offline status
window.addEventListener('online', () => {
	console.log('Connection restored');
});

window.addEventListener('offline', () => {
	console.log('Connection lost');
	if (roadmapGenerator?.isGenerating) {
		roadmapGenerator.handleNetworkError(new Error('Connection lost'));
	}
});

// Export for global access
window.roadmapGenerator = roadmapGenerator; 