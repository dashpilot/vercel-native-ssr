import Handlebars from 'handlebars';
import { readFile, readdir } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded partials
let partialsLoaded = false;

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
	return a === b;
});

/**
 * Parses a route file with <script> and <template> sections
 */
function parseRouteFile(content) {
	const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
	const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);

	if (!scriptMatch || !templateMatch) {
		throw new Error('Route file must contain both <script> and <template> sections');
	}

	return {
		script: scriptMatch[1].trim(),
		template: templateMatch[1].trim()
	};
}

/**
 * Executes the script code in a safe context and returns the data
 */
async function executeScript(scriptCode, req) {
	// Create a module-like environment where data can be exported
	const moduleExports = {};
	const exports = moduleExports;

	// Create context with common globals
	const context = {
		exports,
		fetch: globalThis.fetch,
		Request: globalThis.Request,
		Response: globalThis.Response,
		URL: globalThis.URL,
		console: globalThis.console,
		req // Pass the request object for access to headers, query params, etc.
	};

	try {
		// Wrap the script in an async function that can use all context variables
		const functionBody = `
      return (async () => {
        ${scriptCode}
        return exports;
      })();
    `;

		// Build function parameters from context keys
		const paramNames = Object.keys(context);
		const paramValues = Object.values(context);

		const fn = new Function(...paramNames, functionBody);
		const result = await fn(...paramValues);

		return result || {};
	} catch (error) {
		throw new Error(`Error executing script: ${error.message}`);
	}
}

/**
 * Loads and registers Handlebars partials from the partials directory
 */
async function loadPartials() {
	if (partialsLoaded) {
		return; // Partials already loaded
	}

	try {
		const projectRoot = process.cwd();
		const partialsDir = join(projectRoot, 'partials');

		try {
			const files = await readdir(partialsDir);
			const hbsFiles = files.filter(
				(file) => extname(file) === '.hbs' || extname(file) === '.html'
			);

			for (const file of hbsFiles) {
				const partialPath = join(partialsDir, file);
				const content = await readFile(partialPath, 'utf-8');
				// Remove extension for partial name (e.g., menu.hbs -> menu)
				const partialName = file.replace(/\.(hbs|html)$/, '');
				Handlebars.registerPartial(partialName, content);
			}

			partialsLoaded = true;
		} catch (error) {
			// Partials directory doesn't exist, that's okay
			if (error.code !== 'ENOENT') {
				console.warn('Warning: Could not load partials:', error.message);
			}
			partialsLoaded = true; // Mark as loaded even if directory doesn't exist
		}
	} catch (error) {
		console.warn('Warning: Error loading partials:', error.message);
		partialsLoaded = true; // Mark as loaded to prevent repeated errors
	}
}

/**
 * Renders a Handlebars template with data
 */
async function renderTemplate(templateSource, data) {
	// Load partials before rendering (will only load once due to cache)
	await loadPartials();

	const template = Handlebars.compile(templateSource);
	return template(data);
}

/**
 * Processes a route file and returns the rendered HTML
 */
export async function renderRoute(routePath, req = null) {
	try {
		// Read the route file
		const projectRoot = process.cwd();
		const fullPath = join(projectRoot, 'routes', routePath);
		const content = await readFile(fullPath, 'utf-8');

		// Parse the file
		const { script, template } = parseRouteFile(content);

		// Execute the script to get data
		const data = await executeScript(script, req);

		// Add current path to data for templates
		// Extract current path from route path (for menu active state, etc.)
		let currentPath = '/' + routePath.replace('.html', '');
		if (currentPath === '/index') {
			currentPath = '/';
		}
		// Merge currentPath into data object
		data = { ...data, currentPath };

		// Render the template with the data
		const html = await renderTemplate(template, data);

		return html;
	} catch (error) {
		throw new Error(`Failed to render route ${routePath}: ${error.message}`);
	}
}

/**
 * Main handler function for Vercel serverless/edge functions
 */
export async function handler(req, res) {
	try {
		// Extract route from URL path
		let routePath;

		if (req.query && req.query.path && Array.isArray(req.query.path) && req.query.path.length > 0) {
			// Catch-all route: /api/[[...path]] provides path as array
			routePath = req.query.path.join('/');
		} else if (req.url) {
			// Parse URL to get pathname without query string
			// req.url might be just the path, or a full URL
			let urlPath = req.url;

			// Remove query string if present
			const queryIndex = urlPath.indexOf('?');
			if (queryIndex !== -1) {
				urlPath = urlPath.substring(0, queryIndex);
			}

			// Remove /api prefix if present (from Vercel rewrite)
			if (urlPath.startsWith('/api/')) {
				urlPath = urlPath.slice(5);
			} else if (urlPath === '/api') {
				// Handle /api without trailing slash
				urlPath = '';
			}

			// Remove leading slash
			if (urlPath.startsWith('/')) {
				urlPath = urlPath.slice(1);
			}

			routePath = urlPath;
		} else {
			routePath = '';
		}

		// Default to index.html if route is empty
		if (!routePath || routePath === '') {
			routePath = 'index.html';
		} else {
			// Add .html extension if not present
			if (!routePath.endsWith('.html')) {
				routePath = `${routePath}.html`;
			}
		}

		// Render the route
		const html = await renderRoute(routePath, req);

		// Send response
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.status(200).send(html);
	} catch (error) {
		res.setHeader('Content-Type', 'text/plain; charset=utf-8');
		res.status(500).send(`Error: ${error.message}`);
	}
}
